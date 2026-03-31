"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import * as THREE from "three";

import { ROLEDEX_ITEMS, type RolodexItem } from "@/components/rolodex-data";
import styles from "@/components/rolodex-scene.module.css";

type SceneItem = RolodexItem & {
  baseIndex: number;
  ringKey: string;
};

type SceneCard = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  item: SceneItem;
  baseAngle: number;
};

const ITEM_MULTIPLIER = 3;
const FULL_ROTATION = Math.PI * 2;
const BASE_CARD_WIDTH = 120;
const BASE_CARD_HEIGHT = 90;
const RING_TILT_X = 0.1;
const RING_TILT_Z = 0;
const MAX_PIXEL_RATIO = 1.25;
const ROTATION_EPSILON = 0.0002;
const LIFT_EPSILON = 0.08;
const SCALE_EPSILON = 0.0008;
const CAMERA_EPSILON = 0.12;

const SCENE_ITEMS: SceneItem[] = Array.from({ length: ITEM_MULTIPLIER }, (_, repetition) =>
  ROLEDEX_ITEMS.map((item, baseIndex) => ({
    ...item,
    baseIndex,
    ringKey: `${repetition}-${item.id}`,
  })),
).flat();

function getFrontCardIndex(rotation: number, count: number) {
  const step = FULL_ROTATION / count;
  return Math.round(THREE.MathUtils.euclideanModulo(-rotation, FULL_ROTATION) / step) % count;
}

function getClamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPreviewItem(index: number) {
  return ROLEDEX_ITEMS[index] ?? ROLEDEX_ITEMS[0];
}

export default function RolodexScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeBaseIndex, setActiveBaseIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const setPreviewIndex = useEffectEvent((nextBaseIndex: number) => {
    startTransition(() => {
      setActiveBaseIndex((currentIndex) =>
        currentIndex === nextBaseIndex ? currentIndex : nextBaseIndex,
      );
    });
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updateMotionPreference();

    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let framePending = false;
    let hoverDirty = true;
    let lastPreviewBaseIndex = -1;
    let resizeObserver: ResizeObserver | null = null;

    const pointer = new THREE.Vector2(2, 2);
    const raycaster = new THREE.Raycaster();
    const scratchScale = new THREE.Vector3();

    const interaction = {
      activePointerId: -1,
      dragging: false,
      dragMoved: false,
      dragStartRotation: 0,
      dragStartX: 0,
      hoveredRingIndex: null as number | null,
      pointerInside: false,
      pointerType: "mouse",
      targetRotation: 0,
      currentRotation: 0,
      pointerX: 0,
      pointerY: 0,
      radiusX: 0,
      radiusZ: 0,
      cardScale: 1,
      baseCameraY: 0,
      baseCameraZ: 0,
      baseLookAtY: 0,
      groupY: 0,
    };

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 2000);
    const group = new THREE.Group();
    const textureLoader = new THREE.TextureLoader();
    const geometry = new THREE.PlaneGeometry(BASE_CARD_WIDTH, BASE_CARD_HEIGHT, 1, 1);
    const cards: SceneCard[] = [];
    const cardMeshes: THREE.Mesh[] = [];
    const materials = new Map<string, THREE.MeshBasicMaterial>();
    const uniqueTextures = new Map<string, THREE.Texture>();

    const requestRender = () => {
      if (cancelled || framePending) {
        return;
      }

      framePending = true;
      frameId = window.requestAnimationFrame(renderScene);
    };

    const updateLayout = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const minSide = Math.max(Math.min(width, height), 360);

      renderer.setSize(width, height, false);

      interaction.cardScale = getClamp(minSide * 0.00088, 0.8, 1.02);
      interaction.radiusX = getClamp(minSide * 0.36, 150, 328);
      interaction.radiusZ = interaction.radiusX * 0.82;
      interaction.baseCameraY = getClamp(minSide * 0.6, 260, 540);
      interaction.baseCameraZ = getClamp(minSide * 0.98, 470, 900);
      interaction.baseLookAtY = getClamp(minSide * 0.09, 26, 48);
      interaction.groupY = getClamp(minSide * 0.01, -6, 14);

      camera.fov = width < 640 ? 54 : width < 1024 ? 50 : 46;
      camera.aspect = width / height;
      camera.position.set(
        camera.position.x,
        interaction.baseCameraY,
        interaction.baseCameraZ,
      );
      camera.updateProjectionMatrix();
      group.position.y = interaction.groupY;

      for (const card of cards) {
        const x = Math.sin(card.baseAngle) * interaction.radiusX;
        const z = Math.cos(card.baseAngle) * interaction.radiusZ;

        card.mesh.position.set(x, card.mesh.position.y, z);
        card.mesh.rotation.y = Math.PI / 2 + card.baseAngle;
        card.mesh.scale.setScalar(interaction.cardScale);
      }

      hoverDirty = true;
      requestRender();
    };

    const syncHover = () => {
      const previousHover = interaction.hoveredRingIndex;

      if (!interaction.pointerInside || interaction.pointerType !== "mouse") {
        interaction.hoveredRingIndex = null;
        hoverDirty = false;
        return previousHover !== null;
      }

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(cardMeshes, false);

      interaction.hoveredRingIndex =
        hits.length > 0 ? (hits[0].object.userData.ringIndex as number) : null;

      hoverDirty = false;
      return previousHover !== interaction.hoveredRingIndex;
    };

    const setPointerFromEvent = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      const normalizedX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      pointer.set(normalizedX, normalizedY);
      interaction.pointerX = normalizedX;
      interaction.pointerY = normalizedY;
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      interaction.targetRotation += event.deltaY * 0.00046;
      requestRender();
    };

    const handlePointerDown = (event: PointerEvent) => {
      interaction.activePointerId = event.pointerId;
      interaction.dragging = true;
      interaction.dragMoved = false;
      interaction.dragStartRotation = interaction.targetRotation;
      interaction.dragStartX = event.clientX;
      interaction.pointerInside = true;
      interaction.pointerType = event.pointerType;
      setPointerFromEvent(event);
      hoverDirty = true;

      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
      requestRender();
    };

    const handlePointerMove = (event: PointerEvent) => {
      interaction.pointerInside = true;
      interaction.pointerType = event.pointerType;
      setPointerFromEvent(event);
      hoverDirty = true;

      if (!interaction.dragging || event.pointerId !== interaction.activePointerId) {
        requestRender();
        return;
      }

      const deltaX = event.clientX - interaction.dragStartX;

      interaction.dragMoved = interaction.dragMoved || Math.abs(deltaX) > 4;
      interaction.targetRotation = interaction.dragStartRotation + deltaX * 0.0085;
      requestRender();
    };

    const releaseDrag = (event: PointerEvent) => {
      if (event.pointerId !== interaction.activePointerId) {
        return;
      }

      const hoveredCard =
        interaction.hoveredRingIndex !== null ? cards[interaction.hoveredRingIndex] : null;

      if (!interaction.dragMoved && hoveredCard?.item.href) {
        window.open(hoveredCard.item.href, "_self");
      }

      interaction.activePointerId = -1;
      interaction.dragging = false;
      interaction.dragMoved = false;
      renderer.domElement.style.cursor =
        interaction.hoveredRingIndex !== null ? "pointer" : "grab";

      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }

      requestRender();
    };

    const handlePointerLeave = () => {
      interaction.pointerInside = false;
      interaction.hoveredRingIndex = null;
      interaction.pointerX = 0;
      interaction.pointerY = 0;
      pointer.set(2, 2);
      hoverDirty = true;

      if (!interaction.dragging) {
        renderer.domElement.style.cursor = "grab";
      }

      requestRender();
    };

    const renderScene = () => {
      framePending = false;

      if (cancelled) {
        return;
      }

      let needsAnotherFrame = false;

      const rotationDelta = interaction.targetRotation - interaction.currentRotation;

      if (Math.abs(rotationDelta) > ROTATION_EPSILON) {
        needsAnotherFrame = true;
      }

      interaction.currentRotation += rotationDelta * (prefersReducedMotion ? 0.22 : 0.12);
      group.rotation.y = interaction.currentRotation;

      if (hoverDirty || needsAnotherFrame) {
        needsAnotherFrame = syncHover() || needsAnotherFrame;
      }

      const frontCardIndex = getFrontCardIndex(interaction.currentRotation, cards.length);
      const activeCard =
        interaction.hoveredRingIndex !== null
          ? cards[interaction.hoveredRingIndex]
          : cards[frontCardIndex];

      if (activeCard && activeCard.item.baseIndex !== lastPreviewBaseIndex) {
        lastPreviewBaseIndex = activeCard.item.baseIndex;
        setPreviewIndex(activeCard.item.baseIndex);
      }

      for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index];
        const isHovered = index === interaction.hoveredRingIndex;
        const isFront = index === frontCardIndex;
        const targetLift = isHovered ? 34 : isFront ? 22 : 0;
        const targetScale =
          interaction.cardScale * (isHovered ? 1.08 : isFront ? 1.03 : 1);

        const liftDelta = targetLift - card.mesh.position.y;

        if (Math.abs(liftDelta) > LIFT_EPSILON) {
          needsAnotherFrame = true;
        }

        card.mesh.position.y += liftDelta * 0.16;

        const scaleDelta = targetScale - card.mesh.scale.x;

        if (Math.abs(scaleDelta) > SCALE_EPSILON) {
          needsAnotherFrame = true;
        }

        const nextScale = card.mesh.scale.x + scaleDelta * 0.16;

        scratchScale.setScalar(nextScale);
        card.mesh.scale.copy(scratchScale);
      }

      const targetCameraX =
        prefersReducedMotion || !interaction.pointerInside
          ? 0
          : interaction.pointerX * interaction.radiusX * 0.1;
      const targetCameraY =
        prefersReducedMotion || !interaction.pointerInside
          ? interaction.baseCameraY
          : interaction.baseCameraY + interaction.pointerY * -interaction.radiusX * 0.06;
      const targetCameraZ =
        prefersReducedMotion || !interaction.pointerInside
          ? interaction.baseCameraZ
          : interaction.baseCameraZ + Math.abs(interaction.pointerX) * interaction.radiusZ * 0.08;

      if (
        Math.abs(targetCameraX - camera.position.x) > CAMERA_EPSILON ||
        Math.abs(targetCameraY - camera.position.y) > CAMERA_EPSILON ||
        Math.abs(targetCameraZ - camera.position.z) > CAMERA_EPSILON
      ) {
        needsAnotherFrame = true;
      }

      camera.position.x += (targetCameraX - camera.position.x) * 0.08;
      camera.position.y += (targetCameraY - camera.position.y) * 0.08;
      camera.position.z += (targetCameraZ - camera.position.z) * 0.08;
      camera.lookAt(0, interaction.baseLookAtY, 0);

      renderer.render(scene, camera);

      if (needsAnotherFrame || hoverDirty) {
        requestRender();
      }
    };

    const loadTexture = (src: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        textureLoader.load(
          src,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            resolve(texture);
          },
          undefined,
          reject,
        );
      });

    const initScene = async () => {
      container.replaceChildren(renderer.domElement);
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.display = "block";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.cursor = "grab";

      scene.add(group);
      group.rotation.x = RING_TILT_X;
      group.rotation.z = RING_TILT_Z;

      const textures = await Promise.all(
        ROLEDEX_ITEMS.map(async (item) => [item.src, await loadTexture(item.src)] as const),
      );

      if (cancelled) {
        for (const [, texture] of textures) {
          texture.dispose();
        }

        return;
      }

      for (const [src, texture] of textures) {
        uniqueTextures.set(src, texture);
        materials.set(
          src,
          new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.08,
            toneMapped: false,
          }),
        );
      }

      for (let index = 0; index < SCENE_ITEMS.length; index += 1) {
        const item = SCENE_ITEMS[index];
        const material = materials.get(item.src);

        if (!material) {
          continue;
        }

        const mesh = new THREE.Mesh(geometry, material);

        mesh.userData.ringIndex = index;
        mesh.userData.baseIndex = item.baseIndex;
        mesh.rotation.y = Math.PI / 2;

        cards.push({
          mesh,
          item,
          baseAngle: (index / SCENE_ITEMS.length) * FULL_ROTATION,
        });
        cardMeshes.push(mesh);

        group.add(mesh);
      }

      updateLayout();
      setPreviewIndex(cards[0]?.item.baseIndex ?? 0);
      setIsReady(true);

      renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
      renderer.domElement.addEventListener("pointerdown", handlePointerDown);
      renderer.domElement.addEventListener("pointermove", handlePointerMove);
      renderer.domElement.addEventListener("pointerup", releaseDrag);
      renderer.domElement.addEventListener("pointercancel", releaseDrag);
      renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

      resizeObserver = new ResizeObserver(updateLayout);
      resizeObserver.observe(container);

      requestRender();
    };

    void initScene();

    return () => {
      cancelled = true;
      setIsReady(false);
      window.cancelAnimationFrame(frameId);

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      renderer.domElement.removeEventListener("wheel", handleWheel);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", releaseDrag);
      renderer.domElement.removeEventListener("pointercancel", releaseDrag);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);

      geometry.dispose();

      for (const material of materials.values()) {
        material.dispose();
      }

      for (const texture of uniqueTextures.values()) {
        texture.dispose();
      }

      renderer.dispose();
      container.replaceChildren();
    };
  }, [prefersReducedMotion]);

  const activeItem = getPreviewItem(activeBaseIndex);

  return (
    <main className={styles.main}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.glowWarm} />
        <div className={styles.glowCool} />
      </div>

      <div className={`${styles.viewport} ${isReady ? styles.ready : ""}`} ref={containerRef} />

      <div className={styles.preview}>
        <div className={styles.previewImageFrame}>
          <Image
            alt={activeItem.title}
            className={styles.previewImage}
            src={activeItem.src}
            width={240}
            height={180}
          />
        </div>

        <p className={styles.previewTitle}>{activeItem.title}</p>
      </div>

      <div className={styles.pill}>Scroll</div>

      <div className={styles.helperWrap}>
        <div className={styles.helper}>Wheel, drag, and swipe</div>
      </div>
    </main>
  );
}

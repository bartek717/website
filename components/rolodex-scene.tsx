"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { ROLEDEX_ITEMS, type RolodexItem } from "@/components/rolodex-data";
import styles from "@/components/rolodex-scene.module.css";
import personalData from "@/personal_data.json";

const TOTAL = ROLEDEX_ITEMS.length;
const SPREAD_X = 360; // px between card centers
const LERP = 0.11;
const WHEEL_STEP_THRESHOLD = 90;

function wrap(n: number) {
  return ((Math.round(n) % TOTAL) + TOTAL) % TOTAL;
}

// Shortest arc from float `from` to integer `to` in modular space
function shortArc(from: number, to: number) {
  const d = (to - from + TOTAL) % TOTAL;
  return d > TOTAL / 2 ? d - TOTAL : d;
}

function itemType(item: RolodexItem) {
  if (item.id.startsWith("project-")) return "Project";
  if (item.id.startsWith("exp-")) return "Experience";
  return "Essay";
}

function usesContainedImage(item: RolodexItem) {
  return item.id.startsWith("exp-");
}

export default function RolodexScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const curRef = useRef(0);    // animated float
  const targetRef = useRef(0); // integer target
  const rafRef = useRef(0);
  const cardsRef = useRef(new Map<number, HTMLDivElement>());
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  const dragX0 = useRef(0);
  const dragT0 = useRef(0);
  const wheelDelta = useRef(0);
  const reducedMotion = useRef(false);

  const [selected, setSelected] = useState<RolodexItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    reducedMotion.current =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // ── Animation loop ──────────────────────────────────────────────
  useEffect(() => {
    let live = true;

    function tick() {
      if (!live) return;

      const arc = shortArc(curRef.current, targetRef.current);
      if (Math.abs(arc) < 0.004) {
        curRef.current = ((targetRef.current % TOTAL) + TOTAL) % TOTAL;
      } else {
        const step = reducedMotion.current ? arc : arc * LERP;
        curRef.current = ((curRef.current + step) % TOTAL + TOTAL) % TOTAL;
      }

      cardsRef.current.forEach((el, idx) => {
        let rel = idx - curRef.current;
        if (rel > TOTAL / 2) rel -= TOTAL;
        if (rel < -TOTAL / 2) rel += TOTAL;
        const abs = Math.abs(rel);

        if (abs > 3.4) {
          el.style.visibility = "hidden";
          return;
        }
        el.style.visibility = "visible";

        const tx = rel * SPREAD_X;
        const ry = -rel * 22;
        const sc = Math.max(0.72, 1 - abs * 0.083);
        const op = Math.max(0, 1 - abs * 0.27).toFixed(3);

        el.style.transform = `translate(calc(-50% + ${tx}px), -50%) rotateY(${ry}deg) scale(${sc})`;
        el.style.opacity = op;
        el.style.zIndex = String(Math.round(100 - abs * 20));

        if (abs < 0.12) {
          el.style.borderColor = "var(--accent)";
          el.style.boxShadow = "0 8px 32px rgb(77 93 67 / 0.18)";
        } else {
          el.style.borderColor = "var(--border)";
          el.style.boxShadow = "0 2px 12px rgb(18 16 12 / 0.07)";
        }
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      live = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Input handlers ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelDelta.current += e.deltaY;

      if (Math.abs(wheelDelta.current) < WHEEL_STEP_THRESHOLD) return;

      const steps = Math.trunc(wheelDelta.current / WHEEL_STEP_THRESHOLD);
      wheelDelta.current -= steps * WHEEL_STEP_THRESHOLD;
      targetRef.current = wrap(targetRef.current + steps);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging.current = true;
      suppressClick.current = false;
      dragX0.current = e.clientX;
      dragT0.current = targetRef.current;
      el.dataset.dragging = "";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      if (Math.abs(dragX0.current - e.clientX) > 8) {
        suppressClick.current = true;
      }
      const steps = Math.round(
        (dragX0.current - e.clientX) / (SPREAD_X * 0.6),
      );
      targetRef.current = wrap(dragT0.current + steps);
    };

    const stopDrag = () => {
      dragging.current = false;
      delete el.dataset.dragging;
      requestAnimationFrame(() => {
        suppressClick.current = false;
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        targetRef.current = wrap(targetRef.current + 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        targetRef.current = wrap(targetRef.current - 1);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, []);

  // ── Modal ────────────────────────────────────────────────────────
  const openModal = (item: RolodexItem) => {
    setSelected(item);
    // Two rAF frames ensures the card mounts before the visible class applies
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setModalOpen(true)),
    );
  };

  const closeModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelected(null), 320);
  };

  // ── Escape key + focus trap ────────────────────────────────────
  useEffect(() => {
    if (!selected) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        return;
      }

      // Focus trap
      if (e.key !== "Tab") return;
      const modal = document.querySelector<HTMLElement>("[role=dialog]");
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    // Focus the close button on open
    const closeBtn = document.querySelector<HTMLElement>(
      "[role=dialog] button",
    );
    closeBtn?.focus();

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const handleClick = (idx: number, item: RolodexItem) => {
    if (suppressClick.current) return;
    const isCentered = wrap(targetRef.current) === idx;
    if (isCentered) {
      openModal(item);
    } else {
      targetRef.current = idx;
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <main className={styles.main}>
      {/* Ambient glows */}
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.glowWarm} />
        <div className={styles.glowCool} />
      </div>

      {/* Carousel */}
      <div
        ref={containerRef}
        className={styles.carouselContainer}
        tabIndex={0}
        aria-label="Portfolio rolodex — use arrow keys or scroll to navigate"
      >
        <div className={styles.carousel}>
          {ROLEDEX_ITEMS.map((item, idx) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) cardsRef.current.set(idx, el);
                else cardsRef.current.delete(idx);
              }}
              className={styles.rolodexCard}
              onClick={() => handleClick(idx, item)}
              role="button"
              tabIndex={-1}
              aria-label={item.title}
            >
              <div
                className={`${styles.cardImageFrame} ${
                  usesContainedImage(item) ? styles.cardImageFrameContained : ""
                }`}
              >
                <Image
                  src={item.src}
                  alt={item.title}
                  fill
                  style={{
                    ...(item.imageScale ? { transform: `scale(${item.imageScale})` } : {}),
                    ...(item.imagePosition ? { objectPosition: item.imagePosition } : {}),
                  }}
                  className={`${styles.cardImage} ${
                    usesContainedImage(item) ? styles.cardImageContained : ""
                  } ${item.darkBg ? styles.cardImageDarkBg : ""}`}
                  loading={idx === 0 ? "eager" : "lazy"}
                  sizes="280px"
                />
              </div>
              <div className={styles.cardBody}>
                <span className={styles.cardTitle}>{item.title}</span>
                {item.meta && (
                  <span className={styles.cardMeta}>{item.meta}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nameplate */}
      <div
        className={`${styles.nameplate} ${selected ? styles.chromeMuted : ""}`}
      >
        <span className={styles.nameplateTitle}>
          {personalData.profile.name}
        </span>
        <span className={styles.nameplateRole}>TPM &amp; product engineer</span>
        <div className={styles.nameplateLinks}>
          <a
            href={`mailto:${personalData.profile.contact.email}`}
            className={styles.nameplateLink}
            aria-label="Email"
          >
            Email
          </a>
          <a
            href={personalData.profile.contact.linkedin}
            className={styles.nameplateLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
          >
            LinkedIn
          </a>
          <a
            href={personalData.profile.contact.twitter}
            className={styles.nameplateLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
          >
            𝕏
          </a>
        </div>
      </div>

      {/* Helper hint */}
      <div
        className={`${styles.helperWrap} ${selected ? styles.chromeMuted : ""}`}
      >
        <div className={styles.helper}>Scroll · drag · arrow keys</div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className={styles.modalRoot}
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <button
            aria-label="Close"
            className={`${styles.modalBackdropButton} ${modalOpen ? styles.modalBackdropButtonVisible : ""}`}
            onClick={closeModal}
            type="button"
          />
          <div
            className={`${styles.modalCard} ${modalOpen ? styles.modalCardVisible : ""}`}
          >
            <button
              className={styles.modalClose}
              onClick={closeModal}
              type="button"
            >
              Close
            </button>

            <div
              className={`${styles.modalMedia} ${
                usesContainedImage(selected) ? styles.modalMediaContained : ""
              }`}
            >
              <Image
                src={selected.src}
                alt={selected.title}
                fill
                style={{
                  ...(selected.imageScale ? { transform: `scale(${selected.imageScale})` } : {}),
                  ...(selected.imagePosition ? { objectPosition: selected.imagePosition } : {}),
                }}
                className={`${styles.modalImage} ${
                  usesContainedImage(selected) ? styles.modalImageContained : ""
                } ${selected.darkBg ? styles.modalImageDarkBg : ""}`}
                sizes="(max-width: 640px) 100vw, 520px"
              />
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalEyebrow}>
                {itemType(selected)}
                {selected.meta ? ` · ${selected.meta}` : ""}
              </p>
              <h2 className={styles.modalTitle}>{selected.title}</h2>
              <p className={styles.modalDescription}>{selected.description}</p>

              {selected.tags && selected.tags.length > 0 && (
                <div className={styles.modalTags}>
                  {selected.tags.map((tag) => (
                    <span key={tag} className={styles.modalTag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {selected.href && (
                <a
                  className={styles.modalAction}
                  href={selected.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

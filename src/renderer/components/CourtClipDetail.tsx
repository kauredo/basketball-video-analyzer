import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faChevronLeft,
  faChevronRight,
  faPause,
  faPlay,
  faRepeat,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/StatsDashboard.module.css";
import { stepClip } from "../utils/courtMap";
import { parseIds } from "../utils/clipFilters";
import { formatDuration } from "../utils/format";
import { formatVideoSrc } from "../utils/paths";
import { inkOn } from "../utils/contrast";
import { Clip, Player } from "../../types/global";

type Rate = 0.5 | 1;

/** ["#7, #11", "Q3", "1:14:03–1:14:11"] with missing parts left out. */
const clipMetaParts = (clip: Clip, players: Player[]): string[] => {
  const numbers = parseIds(clip.players)
    .map(id => players.find(p => p.id === id)?.number)
    .filter((n): n is string => !!n)
    .map(n => `#${n}`);
  const parts: string[] = [];
  if (numbers.length > 0) parts.push(numbers.join(", "));
  if (clip.quarter) parts.push(clip.quarter);
  parts.push(`${formatDuration(clip.start_time)}–${formatDuration(clip.end_time)}`);
  return parts;
};

interface CourtClipDetailProps {
  clip: Clip;
  categoryName: string;
  // Hex, so inkOn() can pick the chip's text colour.
  categoryColor: string;
  players: Player[];
  // Clips of the same dot category on the court, in game order; includes clip.
  siblings: Clip[];
  onSelect: (id: number) => void;
  onClose: () => void;
  onOpenInMainVideo?: (clip: Clip) => void;
}

interface ClipVideoProps {
  clip: Clip;
  loop: boolean;
  rate: Rate;
  onLoopChange: (loop: boolean) => void;
  onRateChange: (rate: Rate) => void;
}

// Keyed by clip id, so a missing file on one clip does not stick to the next.
const ClipVideo: React.FC<ClipVideoProps> = ({ clip, loop, rate, onLoopChange, onRateChange }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [missing, setMissing] = useState(!clip.output_path);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(clip.duration);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  if (missing) {
    return (
      <div className={styles.detailVideoBox}>
        <p className={styles.detailMissing}>{t("app.stats.clipFileMissing")}</p>
      </div>
    );
  }

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {
        // A pause can interrupt play(); ignore.
      });
    } else {
      video.pause();
    }
  };

  const progress = length > 0 ? Math.min(100, (time / length) * 100) : 0;

  return (
    <>
      <div className={styles.detailVideoBox}>
        <video
          ref={videoRef}
          className={styles.detailVideo}
          src={formatVideoSrc(clip.output_path)}
          autoPlay
          loop={loop}
          onError={() => setMissing(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={e => {
            // A new src resets playbackRate.
            e.currentTarget.playbackRate = rate;
            if (Number.isFinite(e.currentTarget.duration)) setLength(e.currentTarget.duration);
          }}
        />
      </div>
      <div className={styles.detailProgress}>
        <div className={styles.detailProgressFill} style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.detailControls}>
        <button
          type="button"
          className={styles.detailIconButton}
          onClick={togglePlay}
          aria-label={isPlaying ? t("app.buttons.pause") : t("app.buttons.play")}
        >
          <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
        </button>
        <span className={styles.detailTime}>
          {formatDuration(time)} / {formatDuration(length)}
        </span>
        <span className={styles.detailSpacer} />
        <button
          type="button"
          className={`${styles.detailToggle} ${loop ? styles.detailToggleOn : ""}`}
          aria-pressed={loop}
          onClick={() => onLoopChange(!loop)}
        >
          <FontAwesomeIcon icon={faRepeat} /> {t("app.stats.loop")}
        </button>
        <div className={styles.detailSegments} role="group" aria-label={t("app.stats.playbackSpeed")}>
          {([0.5, 1] as const).map(value => (
            <button
              key={value}
              type="button"
              className={`${styles.detailToggle} ${rate === value ? styles.detailToggleOn : ""}`}
              aria-pressed={rate === value}
              onClick={() => onRateChange(value)}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export const CourtClipDetail: React.FC<CourtClipDetailProps> = ({
  clip,
  categoryName,
  categoryColor,
  players,
  siblings,
  onSelect,
  onClose,
  onOpenInMainVideo,
}) => {
  const { t } = useTranslation();
  // Survive stepping between clips; reset when the column closes (unmount).
  const [loop, setLoop] = useState(true);
  const [rate, setRate] = useState<Rate>(1);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const steppedByArrow = useRef(false);

  const prevId = stepClip(siblings, clip.id, -1);
  const nextId = stepClip(siblings, clip.id, 1);

  // A disabled button drops focus to <body>. When an arrow step lands on an
  // end, move focus to the other arrow.
  useEffect(() => {
    if (!steppedByArrow.current) return;
    steppedByArrow.current = false;
    if (prevId === null && nextId !== null) nextRef.current?.focus();
    else if (nextId === null && prevId !== null) prevRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  const step = (id: number | null) => {
    if (id === null) return;
    steppedByArrow.current = true;
    onSelect(id);
  };

  const meta = clipMetaParts(clip, players).join(" · ");

  return (
    <section aria-label={t("app.stats.selectedClip")} className={styles.detail}>
      <button
        type="button"
        className={`${styles.detailIconButton} ${styles.detailClose}`}
        onClick={onClose}
        aria-label={t("app.stats.closeClip")}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>

      <ClipVideo
        key={clip.id}
        clip={clip}
        loop={loop}
        rate={rate}
        onLoopChange={setLoop}
        onRateChange={setRate}
      />

      <h3 className={styles.detailTitle}>{clip.title}</h3>
      <div className={styles.detailMeta}>
        <span
          className={styles.detailChip}
          style={{ backgroundColor: categoryColor, color: inkOn(categoryColor) }}
        >
          {categoryName}
        </span>
        <span>{meta}</span>
      </div>
      {clip.notes?.trim() && <p className={styles.detailNotes}>{clip.notes}</p>}

      <div className={styles.detailActions}>
        {onOpenInMainVideo && (
          <button
            type="button"
            className={styles.detailPrimary}
            title={t("app.stats.openInMainVideoHint", { time: formatDuration(clip.start_time) })}
            onClick={() => onOpenInMainVideo(clip)}
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> {t("app.stats.openInMainVideo")}
          </button>
        )}
        <span className={styles.detailSpacer} />
        <button
          ref={prevRef}
          type="button"
          className={styles.detailIconButton}
          onClick={() => step(prevId)}
          disabled={prevId === null}
          aria-label={t("app.stats.prevInCategory", { category: categoryName })}
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <button
          ref={nextRef}
          type="button"
          className={styles.detailIconButton}
          onClick={() => step(nextId)}
          disabled={nextId === null}
          aria-label={t("app.stats.nextInCategory", { category: categoryName })}
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      <h4 className={styles.detailListHeading}>
        {t("app.stats.onCourtHeading", { category: categoryName })}{" "}
        <span className={styles.detailListCount}>{siblings.length}</span>
      </h4>
      <ul className={styles.detailList}>
        {siblings.map(c => {
          const current = c.id === clip.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`${styles.detailRow} ${current ? styles.detailRowCurrent : ""}`}
                aria-current={current ? "true" : undefined}
                onClick={() => onSelect(c.id)}
              >
                <span className={styles.detailRowDot} style={{ backgroundColor: categoryColor }} />
                <span className={styles.detailRowTitle}>{c.title}</span>
                <span className={current ? styles.detailRowPlaying : styles.detailRowMono}>
                  {current ? t("app.stats.playing") : c.quarter ?? ""}
                </span>
                <span className={styles.detailRowMono}>{formatDuration(c.duration)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

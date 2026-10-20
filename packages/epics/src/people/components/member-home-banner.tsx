'use client';

import './member-home-banner.css';

/** Home ground: the mycelium field, its veil, and the paper behind it. */
export function MemberHomeBanner({
  className,
}: {
  /** Extra class on the frame. Space overview uses this to lift the field. */
  className?: string;
} = {}) {
  return (
    <div
      className={
        className ? `member-home-banner ${className}` : 'member-home-banner'
      }
      aria-hidden
    >
      <img
        alt=""
        className="member-home-banner-image"
        src="/brand/strategy-mycelium.png"
      />
      <div className="member-home-banner-veil" />
    </div>
  );
}

import React from 'react';

/**
 * Top-down sea turtle silhouette.
 *
 * Replaces lucide's `Turtle` in the profile placeholder: drawn in side profile
 * at small sizes its shell-and-legs outline reads as a car, which looked like a
 * broken icon rather than an intentional "no photo yet" state. Inline SVG (not
 * the icons8 PNG used in the nav) so it still renders when the app is offline.
 */
export const TurtleSilhouette: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 64 64"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {/* Head */}
    <ellipse cx="32" cy="9" rx="5.5" ry="6" />
    {/* Front flippers */}
    <path d="M19 17.5c-3.4-2.7-9.2-3.7-12.4-1.3-3.2 2.4-2.4 7.6.9 10.5 3.1 2.7 8.2 3.6 12.2 2.3z" />
    <path d="M45 17.5c3.4-2.7 9.2-3.7 12.4-1.3 3.2 2.4 2.4 7.6-.9 10.5-3.1 2.7-8.2 3.6-12.2 2.3z" />
    {/* Rear flippers */}
    <path d="M22 47.5c-2.6 2.7-7.3 5.7-10.6 4.5-2.9-1-3.2-4.9-1-7.8 1.9-2.5 5.6-4.6 9.2-5.3z" />
    <path d="M42 47.5c2.6 2.7 7.3 5.7 10.6 4.5 2.9-1 3.2-4.9 1-7.8-1.9-2.5-5.6-4.6-9.2-5.3z" />
    {/* Tail */}
    <path d="M32 53l3.2 7.2h-6.4z" />
    {/* Carapace */}
    <ellipse cx="32" cy="32" rx="16" ry="20" />
  </svg>
);

export default TurtleSilhouette;

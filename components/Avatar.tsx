import React, { useEffect, useState } from 'react';

interface AvatarProps {
  src?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  className?: string;
}

/**
 * A person's picture, falling back to their initials when they have none or the
 * stored one will not load. A picture that fails to decode used to leave an
 * empty grey circle, because the initials only showed when no picture existed.
 */
const Avatar: React.FC<AvatarProps> = ({ src, firstName, lastName, className = 'size-8' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const initials = `${(firstName || '').trim()[0] || ''}${(lastName || '').trim()[0] || ''}`.toUpperCase();
  const hasPicture = !!src && src.trim() !== '' && !failed;

  return (
    <div className={`${className} rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-white/10 shrink-0`}>
      {hasPicture ? (
        <img
          src={src!}
          alt=""
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-300">
          {initials || '?'}
        </div>
      )}
    </div>
  );
};

export default Avatar;

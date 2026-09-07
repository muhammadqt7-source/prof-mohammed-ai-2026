import React, { useState } from 'react';
import { ExternalLink, Instagram, ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';

export interface AccountCardProps {
  platform: 'Instagram' | 'TikTok' | string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  targetUrl?: string;
  isVerified?: boolean;
  compact?: boolean;
  className?: string;
  showFollowButton?: boolean;
  showFollowHint?: boolean;
  onClick?: () => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  platform,
  username,
  displayName,
  avatarUrl,
  targetUrl,
  isVerified,
  compact = false,
  className = '',
  showFollowButton = true,
  showFollowHint = false,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

  // Clean username: remove ANY leading @ and whitespace
  const cleanUsername = (username || '').replace(/^@+/, '').trim();
  const isInstagram = platform.toLowerCase().includes('insta');

  // Strict official URL derived directly from targetUrl or targetUsername
  // Instagram: https://www.instagram.com/{username}/
  // TikTok: https://www.tiktok.com/@{username}
  const resolvedUrl = targetUrl || (isInstagram
    ? `https://www.instagram.com/${cleanUsername}/`
    : `https://www.tiktok.com/@${cleanUsername}`);

  // Strict separation: targetUsername alone does NOT make an account verified.
  // An account is verified ONLY if confirmed from an official allowed source.
  const hasOfficialAvatar = Boolean(avatarUrl && !imgError);
  const hasOfficialDisplayName = Boolean(displayName && displayName.trim() !== '');

  // Account is verified ONLY if explicitly marked true OR verified official data exists AND isVerified is not false
  const isAccountVerified = Boolean(
    isVerified === true || (isVerified !== false && hasOfficialAvatar && hasOfficialDisplayName)
  );

  // Handle follow/open click: purely opens the official external profile, does NOT grant any points
  const handleOpenAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (cleanUsername) {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!cleanUsername) {
    return null;
  }

  return (
    <div
      onClick={handleOpenAccount}
      role="button"
      tabIndex={0}
      title={`فتح حساب @${cleanUsername} على ${isInstagram ? 'Instagram' : 'TikTok'}`}
      className={`group relative flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden select-none ${
        isAccountVerified
          ? isInstagram
            ? 'bg-neutral-950/90 hover:bg-neutral-900/90 border-neutral-800 hover:border-rose-500/40 hover:shadow-[0_0_15px_rgba(244,63,94,0.12)]'
            : 'bg-neutral-950/90 hover:bg-neutral-900/90 border-neutral-800 hover:border-amber-400/50 hover:shadow-[0_0_15px_rgba(234,179,8,0.12)]'
          : 'bg-neutral-950/80 hover:bg-neutral-900/80 border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_12px_rgba(245,158,11,0.08)]'
      } ${className}`}
    >
      {/* Background ambient glow on hover */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none ${
          isInstagram
            ? 'bg-gradient-to-r from-yellow-500 via-rose-500 to-purple-600'
            : 'bg-gradient-to-r from-amber-500 to-yellow-400'
        }`}
      />

      {/* Account Info: Verified (Avatar + Name) OR Unverified (Official Platform Logo + Alert Badge + @username) */}
      <div className="flex items-center gap-2.5 min-w-0 relative z-10">
        {/* Profile Picture or Official Platform Icon */}
        <div className="relative shrink-0">
          {isAccountVerified && hasOfficialAvatar ? (
            <>
              <img
                src={avatarUrl}
                alt={cleanUsername}
                onError={() => setImgError(true)}
                referrerPolicy="no-referrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-neutral-700 group-hover:border-amber-400/80 transition-colors shadow-sm"
              />
              {/* Platform Mini Badge on Avatar */}
              <div
                className={`absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shadow-sm border border-neutral-900 ${
                  isInstagram
                    ? 'bg-gradient-to-tr from-yellow-500 via-rose-500 to-purple-600 text-white'
                    : 'bg-black text-amber-400 font-bold'
                }`}
              >
                {isInstagram ? <Instagram className="w-2 h-2" /> : <span>♪</span>}
              </div>
            </>
          ) : (
            /* Unverified Account: strictly official platform icon, never a fake avatar or generated initials */
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-white shadow-inner border transition-transform group-hover:scale-105 ${
                isInstagram
                  ? 'bg-gradient-to-tr from-yellow-500 via-rose-500 to-purple-600 border-rose-400/30'
                  : 'bg-neutral-900 border-neutral-700 text-amber-400'
              }`}
            >
              {isInstagram ? (
                <Instagram className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              ) : (
                <span className="text-base sm:text-lg leading-none text-amber-400 font-bold">♪</span>
              )}
            </div>
          )}
        </div>

        {/* Text Details */}
        <div className="min-w-0 text-right">
          {isAccountVerified && (displayName || hasOfficialAvatar) ? (
            <>
              <div className="flex items-center gap-1">
                <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate max-w-[120px] sm:max-w-[160px]">
                  {displayName || cleanUsername}
                </h4>
                <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-2.5 h-2.5 ml-0.5" />
                  <span>متحقق</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[11px] font-mono text-neutral-400 group-hover:text-neutral-200 transition-colors truncate dir-ltr text-right">
                  @{cleanUsername}
                </p>
                <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 font-medium">
                  {isInstagram ? 'Instagram' : 'TikTok'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300 font-semibold flex items-center gap-1">
                  <ShieldAlert className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span>ACCOUNT_DATA_UNAVAILABLE</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold font-mono text-neutral-200 group-hover:text-amber-300 transition-colors truncate dir-ltr text-right">
                @{cleanUsername}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Real Follow Button [ متابعة ] */}
      {(showFollowButton || showFollowHint) && (
        <div className="shrink-0 relative z-10">
          <button
            type="button"
            onClick={handleOpenAccount}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 shadow-sm cursor-pointer ${
              isInstagram
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.3)] hover:brightness-110'
                : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 shadow-[0_0_12px_rgba(234,179,8,0.25)] hover:brightness-105'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span>متابعة</span>
          </button>
        </div>
      )}
    </div>
  );
};

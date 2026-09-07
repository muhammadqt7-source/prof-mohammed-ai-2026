/**
 * Pure URL parser for Instagram and TikTok profiles.
 * Extracts username safely without scraping.
 * 
 * Strict Validation Rules:
 * - Rejects posts, reels, stories, explore, and non-profile links for Instagram.
 * - Rejects videos, live, tags, music, and non-profile content links for TikTok.
 * - Does NOT treat any extracted string as automatically valid without profile format verification.
 */

export interface ParsedProfileInfo {
  isValid: boolean;
  platform: 'Instagram' | 'TikTok';
  username: string; // e.g. "@username"
  cleanUsername: string; // e.g. "username"
  canonicalUrl: string;
  error?: string;
}

export function parseProfileUrl(
  rawInput: string,
  platformHint?: 'Instagram' | 'TikTok'
): ParsedProfileInfo {
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    return {
      isValid: false,
      platform: platformHint || 'Instagram',
      username: '',
      cleanUsername: '',
      canonicalUrl: '',
      error: 'يرجى إدخال رابط الحساب المستهدف',
    };
  }

  const input = rawInput.trim();

  // Determine platform from URL or platform hint
  let platform: 'Instagram' | 'TikTok' = platformHint || 'Instagram';
  const lowerInput = input.toLowerCase();
  if (lowerInput.includes('tiktok.com')) {
    platform = 'TikTok';
  } else if (lowerInput.includes('instagram.com') || lowerInput.includes('instagr.am')) {
    platform = 'Instagram';
  }

  let hostname = '';
  let pathname = '';

  try {
    const urlStringToParse =
      input.startsWith('http://') || input.startsWith('https://')
        ? input
        : input.includes('.')
        ? `https://${input}`
        : '';

    if (urlStringToParse) {
      const parsed = new URL(urlStringToParse);
      hostname = parsed.hostname.toLowerCase();
      pathname = parsed.pathname;

      if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
        platform = 'Instagram';
      } else if (hostname.includes('tiktok.com')) {
        platform = 'TikTok';
      } else {
        return {
          isValid: false,
          platform,
          username: '',
          cleanUsername: '',
          canonicalUrl: '',
          error: `الرابط المدخل لا يتبع منصة ${platform}. يرجى إدخال رابط ${platform} رسمي.`,
        };
      }
    } else {
      // Input was not a URL
      return {
        isValid: false,
        platform,
        username: '',
        cleanUsername: '',
        canonicalUrl: '',
        error: platform === 'Instagram'
          ? 'يرجى إدخال رابط الحساب الشخصي (مثال: https://www.instagram.com/username/)'
          : 'يرجى إدخال رابط الحساب الشخصي (مثال: https://www.tiktok.com/@username)',
      };
    }
  } catch {
    return {
      isValid: false,
      platform,
      username: '',
      cleanUsername: '',
      canonicalUrl: '',
      error: 'صيغة الرابط غير صحيحة. يرجى إدخال رابط صالح.',
    };
  }

  // Normalize pathname: remove leading and trailing slashes and split
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

  if (segments.length === 0) {
    return {
      isValid: false,
      platform,
      username: '',
      cleanUsername: '',
      canonicalUrl: '',
      error: platform === 'Instagram'
        ? 'يرجى إدخال رابط الحساب الشخصي وليس رابط منشور أو Reel.'
        : 'يرجى إدخال رابط الحساب الشخصي (Profile) وليس رابط فيديو أو محتوى.',
    };
  }

  // Specific validation for Instagram
  if (platform === 'Instagram') {
    const nonProfileWords = [
      'p',
      'reel',
      'reels',
      'stories',
      'explore',
      'direct',
      'accounts',
      'developer',
      'legal',
      'about',
      'help',
      'api',
      'tags',
      'tv',
      'share',
      'channel',
      'live',
      'login',
      'signup',
    ];

    const firstSegmentLower = segments[0].toLowerCase();

    // Check if first segment is a post, reel, story, or system path
    if (nonProfileWords.includes(firstSegmentLower)) {
      return {
        isValid: false,
        platform: 'Instagram',
        username: '',
        cleanUsername: '',
        canonicalUrl: '',
        error: 'يرجى إدخال رابط الحساب الشخصي وليس رابط منشور أو Reel.',
      };
    }

    // Direct Instagram profile URL must only have ONE path segment: /<username>/
    // If it has multiple segments (e.g. /username/reel/123 or /username/channel), it's not a profile URL
    if (segments.length > 1) {
      return {
        isValid: false,
        platform: 'Instagram',
        username: '',
        cleanUsername: '',
        canonicalUrl: '',
        error: 'يرجى إدخال رابط الحساب الشخصي وليس رابط منشور أو Reel.',
      };
    }

    const rawUsername = segments[0].replace(/^@+/, '');

    // Instagram username regex: 1 to 30 chars, alphanumeric + periods and underscores
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(rawUsername)) {
      return {
        isValid: false,
        platform: 'Instagram',
        username: '',
        cleanUsername: '',
        canonicalUrl: '',
        error: 'اسم المستخدم المستخرج من الرابط غير صالح (يجب أن يحتوي على أحرف وأرقام ونقاط فقط)',
      };
    }

    const canonicalUrl = `https://www.instagram.com/${rawUsername}/`;

    return {
      isValid: true,
      platform: 'Instagram',
      username: `@${rawUsername}`,
      cleanUsername: rawUsername,
      canonicalUrl,
    };
  }

  // Specific validation for TikTok
  if (platform === 'TikTok') {
    // vm.tiktok.com is for short video shares, not profiles
    if (hostname.includes('vm.tiktok.com') || hostname.includes('vt.tiktok.com')) {
      return {
        isValid: false,
        platform: 'TikTok',
        username: '',
        cleanUsername: '',
        canonicalUrl: '',
        error: 'يرجى إدخال رابط الحساب الشخصي (Profile) وليس رابط فيديو أو محتوى.',
      };
    }

    const nonProfileWords = [
      'video',
      'tag',
      'music',
      'discover',
      'live',
      'foryou',
      'about',
      'legal',
      'help',
      'api',
      'upload',
      'embed',
      'explore',
      'photo',
    ];

    const firstSegmentLower = segments[0].toLowerCase();

    // If first segment is video or media
    if (nonProfileWords.includes(firstSegmentLower)) {
      return {
        isValid: false,
        platform: 'TikTok',
        username: '',
        cleanUsername: '',
        canonicalUrl: '',
        error: 'يرجى إدخال رابط الحساب الشخصي (Profile) وليس رابط فيديو أو محتوى.',
      };
    }

    // Check if any subsegment points to video or content (e.g. /@username/video/12345 or /@username/live)
    if (segments.length > 1) {
      const hasContentSubpath = segments.slice(1).some((s) =>
        ['video', 'live', 'photo', 'music', 'item'].includes(s.toLowerCase())
      );
      if (hasContentSubpath || segments.length > 1) {
        return {
          isValid: false,
          platform: 'TikTok',
          username: '',
          cleanUsername: '',
          canonicalUrl: '',
          error: 'يرجى إدخال رابط الحساب الشخصي (Profile) وليس رابط فيديو أو محتوى.',
        };
      }
    }

    // TikTok profile segment must start with '@' e.g. /@username
    if (!segments[0].startsWith('@')) {
      return {
        isValid: false,
        platform: 'TikTok',
        username: '',
        cleanUsername: '',
        canonicalUrl: '',
        error: 'يرجى إدخال رابط حساب TikTok الشخصي بالشكل: https://www.tiktok.com/@username',
      };
    }

    const rawUsername = segments[0].replace(/^@+/, '');

    // TikTok username regex: 1 to 30 chars, letters, numbers, periods, and underscores
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(rawUsername)) {
      return {
        isValid: false,
        platform: 'TikTok',
        username: '',
        cleanUsername: '',
        canonicalUrl: '',
        error: 'اسم المستخدم المستخرج من الرابط غير صالح (يجب أن يحتوي على أحرف وأرقام ونقاط فقط)',
      };
    }

    const canonicalUrl = `https://www.tiktok.com/@${rawUsername}`;

    return {
      isValid: true,
      platform: 'TikTok',
      username: `@${rawUsername}`,
      cleanUsername: rawUsername,
      canonicalUrl,
    };
  }

  return {
    isValid: false,
    platform,
    username: '',
    cleanUsername: '',
    canonicalUrl: '',
    error: 'رابط الحساب غير صالح',
  };
}

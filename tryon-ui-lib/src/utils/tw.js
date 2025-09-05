// utils/tw.js
export function tw(...parts) {
  const SKIP_PREFIX = /^(tryon-|swiper-|lucide|polaris-|shopify-|prose|recharts|rdg|Mui|ant-|Leaflet|mapboxgl|slick-)/;

  const prefixOne = (token) => {
    if (!token) return token;
    // split variant chain: e.g. "md:hover:!p-4"
    const segs = token.split(':');
    let util = segs.pop();

    // keep third-party classes & already-prefixed utilities
    if (SKIP_PREFIX.test(util)) {
      segs.push(util);
      return segs.join(':');
    }

    // handle leading "!" important
    let bang = '';
    if (util.startsWith('!')) {
      bang = '!';
      util = util.slice(1);
    }

    // only prefix if not already
    if (!util.startsWith('tryon-')) util = 'tryon-' + util;

    segs.push(bang + util);
    return segs.join(':');
  };

  return parts
    .flat(Infinity)
    .filter(Boolean)
    .join(' ')
    .trim()
    .split(/\s+/)
    .map(prefixOne)
    .join(' ');
}

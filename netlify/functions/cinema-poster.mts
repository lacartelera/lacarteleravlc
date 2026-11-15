// Only official cinema image hosts and image paths may be fetched.
export function allowedImage(url: URL) {
  return url.protocol === 'https:' && !url.port && !url.username && !url.password
    && /^(?:(?:www\.)?cines(?:babel|lys)\.com|ivc\.gva\.es|www\.uv\.es|www\.upv\.es|www\.consorcimuseus\.gva\.es|www\.muvim\.es|(?:cineslys|abcpark|abcgranturia|abcelsaler|cinestudiodor|cinesmn4)\.reservaentradas\.com|cdn\.cinesabc\.com|eu-static\.yelmocines\.es|blogger\.googleusercontent\.com)$/.test(url.hostname)
    && /\.(?:jpe?g|png|webp|gif|avif)$/i.test(url.pathname);
}

export function imageType(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes[0] === 137 && String.fromCharCode(...bytes.slice(1,4)) === 'PNG') return 'image/png';
  if (String.fromCharCode(...bytes.slice(0,3)) === 'GIF') return 'image/gif';
  if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  if (String.fromCharCode(...bytes.slice(4,12)) === 'ftypavif') return 'image/avif';
  return '';
}

export default async (request: Request) => {
  try {
    let url = new URL(new URL(request.url).searchParams.get('url') || '');
    for (let redirects=0; redirects<4; redirects++) {
      if (!allowedImage(url)) return new Response(null,{status:400});
      const response = await fetch(url,{
        redirect:'manual', signal:AbortSignal.timeout(8000),
        headers:{Referer:`${url.origin}/`,'User-Agent':'CineValencia/1.0 (public cinema agenda)'},
      });
      if ([301,302,303,307,308].includes(response.status)) {
        url=new URL(response.headers.get('location') || '',url);
        continue;
      }
      if (!response.ok) break;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const type=imageType(bytes);
      if (!type || bytes.length>10_000_000) break;
      return new Response(bytes,{headers:{
        'Content-Type':type,'X-Content-Type-Options':'nosniff',
        'Cache-Control':'public, max-age=3600, s-maxage=86400',
      }});
    }
  } catch { /* The browser proceeds to the next official image, then Letterboxd. */ }
  return new Response(null,{status:404,headers:{'Cache-Control':'public, max-age=60'}});
};

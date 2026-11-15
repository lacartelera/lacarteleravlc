// Convert a crop rectangle into the CSS position of the complete source image.
export function cropPosition(crop, width, height) {
  const clamp = value => Math.max(0, Math.min(100, value));
  const x = width > crop.width ? clamp(crop.x / (width - crop.width) * 100) : 50;
  const y = height > crop.height ? clamp(crop.y / (height - crop.height) * 100) : 50;
  return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
}

export async function framePoster(image) {
  if (!image.naturalWidth || !image.naturalHeight) return;
  const source=image.currentSrc || image.src;
  try {
    const delivery=new URL(source, 'https://local.invalid');
    const original=new URL(delivery.searchParams.get('url') || delivery.href);
    // This Filmoteca still places both faces on the left; keep them inside the portrait frame.
    if(original.hostname==='ivc.gva.es' && /\/te_doy_mis_ojos(?:_thumb)?\.jpg$/i.test(original.pathname)) {
      image.style.objectPosition='12% 50%';
      return;
    }
  } catch { /* Other sources retain automatic framing. */ }
  if (!globalThis.smartcrop) return;
  try {
    const boost=[];
    // Where supported, real face detections take precedence over general saliency.
    if (globalThis.FaceDetector) {
      try {
        const faces=await new globalThis.FaceDetector({fastMode:true,maxDetectedFaces:4}).detect(image);
        for(const {boundingBox:box} of faces) boost.push({x:box.x,y:box.y,width:box.width,height:box.height,weight:1.5});
      } catch { /* Skin tones and edge detail remain available in Smartcrop. */ }
    }
    const {topCrop}=await globalThis.smartcrop.crop(image,{
      width:108,height:162,minScale:1,maxScale:1,boost,
      // Skin tones favour people; edge detail also favours lettering on posters.
      skinWeight:2.2,detailWeight:0.4,
    });
    if(image.isConnected && (image.currentSrc || image.src)===source) {
      image.style.objectPosition=cropPosition(topCrop,image.naturalWidth,image.naturalHeight);
    }
  } catch {
    // Cross-origin originals may not permit canvas analysis; retain the upper-centre framing.
  }
}

export function posterSources(session) {
  const sources=[];
  const officials=[...new Set([session.poster,...(session.posters || [])])].filter(url=>/^https:\/\//.test(url || ''));
  for(const url of officials) {
    // Same-origin delivery avoids hotlink restrictions and missing upstream MIME headers.
    sources.push({url:`/.netlify/functions/cinema-poster?url=${encodeURIComponent(url)}`,label:session.venue});
    sources.push({url,label:session.venue});
  }
  const credits=(session.title || '').match(/\(([^()]+),\s*((?:18|19|20)\d{2})\)\s*$/);
  const title=credits ? session.title.slice(0,credits.index).trim() : session.title;
  const params=new URLSearchParams({title});
  const details=session.details || '';
  const year=session.year || credits?.[2] || session.title.match(/\(((?:18|19|20)\d{2})\)/)?.[1] || details.match(/(?:·\s*|,\s*)((?:18|19|20)\d{2})(?:\s*·|\s*$)/)?.[1];
  if(year) params.set('year',String(year));
  const director=session.director || credits?.[1] || details.match(/Director:\s*(.+?)\s+Duración:/)?.[1] || (/·\s*(?:18|19|20)\d{2}\s*·/.test(details) ? details.split('·')[0].trim() : '');
  if(director) params.set('director',director);
  sources.push({url:`/.netlify/functions/letterboxd-poster?${params}`,label:'Letterboxd'});
  params.set('original','1');
  sources.push({url:`/.netlify/functions/letterboxd-poster?${params}`,label:'Letterboxd'});
  return sources;
}

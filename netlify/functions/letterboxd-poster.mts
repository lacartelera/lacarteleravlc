import {posterCandidates,parseLetterboxdPoster,searchFilmSlugs} from '../../lib/letterboxd.ts';
export default async (request: Request) => {
  const params=new URL(request.url).searchParams,title=(params.get('title') || '').slice(0,240),director=(params.get('director') || '').slice(0,160),year=Number(params.get('year'));
  if(!title.trim()) return new Response(null,{status:400});
  const lookup=posterCandidates(title,year>=1880 && year<=2100 ? year : undefined);
  const deadline=Date.now()+22000;
  let blocked=false;
  const seen=new Set<string>();
  async function read(url:string){
    if(Date.now()>=deadline)return null;
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(Math.min(4000,deadline-Date.now()))});
      if([403,429,503].includes(response.status))blocked=true;
      return response.ok?await response.text():null;
    }catch{return null;}
  }
  async function find(slug:string, search=false){
    if(seen.has(slug) || blocked)return null;
    seen.add(slug);
    const html=await read(`https://letterboxd.com/film/${encodeURIComponent(slug)}/`);
    return html?parseLetterboxdPoster(html,lookup.year,director,search?lookup.title:''):null;
  }
  function result(poster:string){
    const location=params.get('original')==='1'?poster:`/.netlify/images?url=${encodeURIComponent(poster)}&w=648&fit=contain`;
    return new Response(null,{status:302,headers:{Location:location,'Cache-Control':'public, max-age=86400, s-maxage=86400'}});
  }
  for(const slug of lookup.slugs){
    const poster=await find(slug);if(poster)return result(poster);
    if(blocked)break;
  }
  // Search translated titles when their distribution title does not match the film slug.
  // A year or director is required to validate search results against the source film.
  if(!blocked && (lookup.year || director)){
    const html=await read(`https://letterboxd.com/search/films/${encodeURIComponent(lookup.title)}/`);
    if(html && !blocked)for(const slug of searchFilmSlugs(html)){
      const poster=await find(slug,true);if(poster)return result(poster);
      if(blocked)break;
    }
  }
  return new Response(null,{status:404,headers:{'Cache-Control':'public, max-age=300, s-maxage=300'}});
};

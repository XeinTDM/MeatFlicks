const key = process.env.TMDB_API_KEY;
console.log('key', key);
const url = `https://api.themoviedb.org/3/find/tt0120737?external_source=imdb_id&api_key=${key}`;
const res = await fetch(url);
console.log('status', res.status);
console.log(await res.text());

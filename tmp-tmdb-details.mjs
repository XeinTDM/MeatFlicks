const key = '914ebec2be57696f3c9c29e45b61ffea';
const url = https://api.themoviedb.org/3/movie/120?append_to_response=credits,videos&api_key=914ebec2be57696f3c9c29e45b61ffea;
const res = await fetch(url);
console.log('status', res.status);
console.log(await res.text());

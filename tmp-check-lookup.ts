import { lookupTmdbIdByImdbId } from "./src/lib/server/services/tmdb.service";

const ids = ['tt0120737', 'tt0167261', 'tt0347149', 'tt0816692'];

for (const id of ids) {
  try {
    const tmdb = await lookupTmdbIdByImdbId(id);
    console.log(id, tmdb);
  } catch (error) {
    console.error('error for', id, error);
  }
}

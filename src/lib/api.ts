import type { Movie } from '@prisma/client';
import prisma from './prisma';

interface Collection {
  id: number;
  name: string;
  slug: string;
}

interface Genre {
  id: number;
  name: string;
}

export async function getTrendingMovies(): Promise<Movie[]> {
  try {
    const movies = await prisma.movie.findMany({
      orderBy: {
        rating: 'desc',
      },
      take: 20,
    });
    return movies;
  } catch (error) {
    console.error('Error fetching trending movies:', error);
    throw new Error('Failed to fetch trending movies');
  }
}

export async function getCollections(): Promise<Collection[]> {
  try {
    const collections = await prisma.collection.findMany();
    return collections;
  } catch (error) {
    console.error('Error fetching collections:', error);
    throw new Error('Failed to fetch collections');
  }
}

export async function getMoviesByCollection(collectionSlug: string): Promise<Movie[]> {
  try {
    const collection = await prisma.collection.findUnique({
      where: {
        slug: collectionSlug,
      },
      include: {
        movies: true,
      },
    });

    if (!collection) {
      return [];
    }
    return collection.movies;
  } catch (error) {
    console.error(`Error fetching movies for collection ${collectionSlug}:`, error);
    throw new Error(`Failed to fetch movies for collection ${collectionSlug}`);
  }
}

export async function getGenres(): Promise<Genre[]> {
  try {
    const genres = await prisma.genre.findMany();
    return genres;
  } catch (error) {
    console.error('Error fetching genres:', error);
    throw new Error('Failed to fetch genres');
  }
}

export async function getMoviesByGenre(genreName: string): Promise<Movie[]> {
  try {
    const movies = await prisma.movie.findMany({
      where: {
        genres: {
          some: {
            name: genreName,
          },
        },
      },
    });
    return movies;
  } catch (error) {
    console.error(`Error fetching movies for genre ${genreName}:`, error);
    throw new Error(`Failed to fetch movies for genre ${genreName}`);
  }
}
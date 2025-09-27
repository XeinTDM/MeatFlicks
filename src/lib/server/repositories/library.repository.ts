import type { Collection, Genre, Movie } from '@prisma/client';
import prisma from '$lib/server/db';

export const libraryRepository = {
  async findTrendingMovies(limit = 20): Promise<Movie[]> {
    try {
      return await prisma.movie.findMany({
        orderBy: { rating: 'desc' },
        take: limit
      });
    } catch (error) {
      console.error('Error fetching trending movies:', error);
      throw new Error('Failed to fetch trending movies');
    }
  },

  async listCollections(): Promise<Collection[]> {
    try {
      return await prisma.collection.findMany();
    } catch (error) {
      console.error('Error fetching collections:', error);
      throw new Error('Failed to fetch collections');
    }
  },

  async findCollectionMovies(collectionSlug: string): Promise<Movie[]> {
    try {
      const collection = await prisma.collection.findUnique({
        where: { slug: collectionSlug },
        include: { movies: true }
      });

      return collection?.movies ?? [];
    } catch (error) {
      console.error(`Error fetching movies for collection ${collectionSlug}:`, error);
      throw new Error(`Failed to fetch movies for collection ${collectionSlug}`);
    }
  },

  async listGenres(): Promise<Genre[]> {
    try {
      return await prisma.genre.findMany();
    } catch (error) {
      console.error('Error fetching genres:', error);
      throw new Error('Failed to fetch genres');
    }
  },

  async findGenreMovies(genreName: string): Promise<Movie[]> {
    try {
      return await prisma.movie.findMany({
        where: {
          genres: {
            some: { name: genreName }
          }
        }
      });
    } catch (error) {
      console.error(`Error fetching movies for genre ${genreName}:`, error);
      throw new Error(`Failed to fetch movies for genre ${genreName}`);
    }
  }
};

export type LibraryRepository = typeof libraryRepository;
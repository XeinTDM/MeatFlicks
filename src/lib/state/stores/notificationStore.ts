import { writable, get } from 'svelte/store';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'movie-added';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timeout?: number;
    metadata?: any;
}

function createNotificationStore() {
    const { subscribe, update } = writable<Notification[]>([]);

    function add(notification: Omit<Notification, 'id'>) {
        const id = crypto.randomUUID();
        const newNotification: Notification = { id, ...notification };

        update((n) => [...n, newNotification]);

        if (notification.timeout !== 0) {
            setTimeout(() => {
                remove(id);
            }, notification.timeout ?? 5000);
        }

        return id;
    }

    function remove(id: string) {
        update((n) => n.filter((item) => item.id !== id));
    }

    return {
        subscribe,
        add,
        remove,
        info: (title: string, message: string) => add({ type: 'info', title, message }),
        success: (title: string, message: string) => add({ type: 'success', title, message }),
        warning: (title: string, message: string) => add({ type: 'warning', title, message }),
        error: (title: string, message: string) => add({ type: 'error', title, message }),
        movieAdded: (movie: { title: string; posterPath?: string | null; tmdbId: number }) =>
            add({
                type: 'movie-added',
                title: 'New Movie Added',
                message: movie.title,
                metadata: movie
            })
    };
}

export const notifications = createNotificationStore();

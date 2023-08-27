export function withResolvers<T>(): {
    promise: Promise<T>;
    resolve: (resolution: T) => void;
    reject: (reason: unknown) => void;
};
/**
 * <T>
 */
export type PromiseKit<T> = ReturnType<typeof withResolvers<T>>;

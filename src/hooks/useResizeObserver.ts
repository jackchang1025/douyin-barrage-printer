import { watch, onUnmounted, type Ref } from 'vue';

/**
 * ResizeObserver Hook
 * 监听元素大小变化
 */
export function useResizeObserver(
    target: Ref<HTMLElement | undefined>,
    callback: (entry: ResizeObserverEntry) => void
) {
    let observer: ResizeObserver | null = null;

    const cleanup = () => {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    };

    const observe = () => {
        cleanup();

        if (!target.value) return;

        observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                callback(entry);
            }
        });

        observer.observe(target.value);
    };

    // 监听 target 变化
    watch(
        () => target.value,
        (newEl) => {
            if (newEl) {
                observe();
            } else {
                cleanup();
            }
        },
        { immediate: true }
    );

    // 组件卸载时清理
    onUnmounted(() => {
        cleanup();
    });

    return {
        stop: cleanup
    };
}

export default useResizeObserver;


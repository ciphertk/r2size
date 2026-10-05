export type SaveFileResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

const isStandalone = (): boolean => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
};

/**
 * Saves a text file. Inside an installed iOS app a Blob download goes nowhere useful, so
 * there the share sheet is used ("Save to Files"); everywhere else, a normal download.
 */
export const saveTextFile = async (name: string, text: string): Promise<SaveFileResult> => {
  try {
    const file = new File([text], name, { type: 'application/json' });
    if (isStandalone() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        // Fall through to a download.
      }
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
};

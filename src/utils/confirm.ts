import { openDialog } from '@/components/ui/Dialog';

/**
 * Confirmation before a destructive or important action. Shows the app's own
 * dialog (the same on iOS, Android and web, translated with the rest of the
 * app); destructive labels such as "Delete" get a red button.
 */
export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  openDialog({ title, message, confirmLabel, onConfirm });
}

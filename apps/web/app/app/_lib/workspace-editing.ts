export const workspacePageClosedEvent = 'erp:workspace-page-closed';
type EditingField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const originals = new WeakMap<EditingField, string | boolean>();

function fieldValue(field: EditingField, original = false): string | boolean {
  if (field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type)) return original ? field.defaultChecked : field.checked;
  if (field instanceof HTMLSelectElement) {
    const selected = Array.from(field.options).filter(option => original ? option.defaultSelected : option.selected);
    return JSON.stringify((original && !selected.length && !field.multiple ? [field.options[0]] : selected).filter(Boolean).map(option => option.value));
  }
  return original ? field.defaultValue : field.value;
}

export function markWorkspaceInputChanged(field: EditingField) {
  if (!originals.has(field)) originals.set(field, fieldValue(field, true));
  if (field.form?.hasAttribute('data-save-state')) field.form.dataset.saveState = 'waiting';
}

export function editingForms(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLFormElement>('form')).filter(form =>
    form.getAttribute('method')?.toLowerCase() !== 'get' &&
    !form.matches('.erp-filter-form, .erp-todo-filters'));
}

export function hasPendingFiles(form: HTMLFormElement) {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]'))
    .some(input => Boolean(input.files?.length));
}

export function hasUnsavedForm(form: HTMLFormElement) {
  if (hasPendingFiles(form)) return true;
  if (form.dataset.saveState === 'saved') return false;
  return ['waiting', 'saving', 'skipped', 'error'].includes(form.dataset.saveState ?? '') ||
    Array.from(form.elements).some(field =>
      (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) &&
      originals.has(field) && originals.get(field) !== fieldValue(field));
}

export function hasUnsavedContent(root: ParentNode | undefined) {
  return !!root && editingForms(root).some(hasUnsavedForm);
}

export function workspacePageElement(pathname: string) {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-workspace-page]'))
    .find(element => element.dataset.workspacePage === pathname);
}

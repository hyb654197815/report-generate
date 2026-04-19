import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { useEffect, useRef } from 'react';

function debounceFn(fn: () => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const wrapped = () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(), ms);
  };
  wrapped.cancel = () => window.clearTimeout(t);
  return wrapped;
}

export type HtmlQuillEditorProps = {
  /** Bumps this when the editor should reset to a new document (e.g. another template element). */
  instanceKey: string;
  /** Initial HTML when instanceKey is created; not continuously controlled. */
  initialHtml: string;
  onHtmlChange: (html: string) => void;
  minHeight?: number;
};

/**
 * Quill snow editor: stores HTML compatible with backend placeholder replacement and Gotenberg.
 */
export function HtmlQuillEditor({
  instanceKey,
  initialHtml,
  onHtmlChange,
  minHeight = 240,
}: HtmlQuillEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const onHtmlChangeRef = useRef(onHtmlChange);
  onHtmlChangeRef.current = onHtmlChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    host.innerHTML = '';
    const q = new Quill(host, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ script: 'sub' }, { script: 'super' }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          [{ align: [] }],
          ['blockquote', 'link', 'clean'],
        ],
      },
    });
    quillRef.current = q;
    q.clipboard.dangerouslyPasteHTML(initialHtml?.trim() ? initialHtml : '<p><br></p>');

    const debounced = debounceFn(() => {
      onHtmlChangeRef.current(q.root.innerHTML);
    }, 280);
    q.on('text-change', debounced);

    return () => {
      debounced.cancel();
      q.off('text-change', debounced);
      quillRef.current = null;
      host.innerHTML = '';
    };
    // initialHtml is read when instanceKey changes (new editor); not synced on every parent HTML tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey]);

  return (
    <div className="html-quill-editor" style={{ minHeight }}>
      <div ref={hostRef} />
    </div>
  );
}

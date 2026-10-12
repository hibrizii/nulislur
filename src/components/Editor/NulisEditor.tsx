import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Extension, Node as TipTapNode, mergeAttributes, textInputRule } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, NodeSelection, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import Paragraph from '@tiptap/extension-paragraph';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TableMap, addColumn, addRow } from '@tiptap/pm/tables';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  AlignLeft, 
  AlignCenter, 
  AlignJustify,
  Indent,
  MessageSquarePlus,
  Trash2,
  X,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Type,
  BookmarkCheck,
  BookmarkPlus,
  History,
  Search,
  Replace,
  ChevronUp,
  ChevronDown,
  Table as TableIcon,
  ListTree,
  BookOpen,
  Plus,
  Palette,
  Edit2,
  Check,
  Sparkles,
} from 'lucide-react';

const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      indent: {
        default: 0,
        parseHTML: (element) => {
          const attr = element.getAttribute('data-indent');
          if (attr) return Math.min(4, Math.max(0, parseInt(attr, 10) || 0));
          const ml = element.style.marginLeft;
          if (ml) {
            if (ml.includes('rem')) return Math.min(4, Math.round(parseFloat(ml) / 1.25));
            if (ml.includes('px')) return Math.min(4, Math.round(parseFloat(ml) / 20));
            if (ml.includes('pt')) return Math.min(4, Math.round(parseFloat(ml) / 18));
          }
          return 0;
        },
        renderHTML: (attributes) => {
          const level = Math.min(4, Math.max(0, attributes.indent || 0));
          if (level === 0) {
            return {};
          }
          return {
            'data-indent': level,
            style: `margin-left: ${level * 1.25}rem;`,
          };
        },
      },
      hangingIndent: {
        default: false,
        parseHTML: (element) => {
          return (
            element.getAttribute('data-hanging-indent') === 'true' ||
            element.classList.contains('nulis-hanging-indent') ||
            (element.style.textIndent && parseFloat(element.style.textIndent) < 0)
          );
        },
        renderHTML: (attributes) => {
          if (!attributes.hangingIndent) {
            return {};
          }
          return {
            'data-hanging-indent': 'true',
            class: 'nulis-hanging-indent',
            style: 'padding-left: 2rem !important; text-indent: -2rem !important;',
          };
        },
      },
    };
  },
});

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-background-color') || element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            'data-background-color': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor} !important;`,
          };
        },
      },
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-background-color') || element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            'data-background-color': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor} !important;`,
          };
        },
      },
    };
  },
});

const TABLE_COLOR_PALETTE = [
  { name: 'Abu-abu Lembut', value: '#F4F4F5' },
  { name: 'Kuning Hangat', value: '#FEF3C7' },
  { name: 'Hijau Daun', value: '#D1FAE5' },
  { name: 'Biru Lembut', value: '#E0F2FE' },
  { name: 'Merah Muda', value: '#FFE4E6' },
  { name: 'Ungu Lavender', value: '#EDE9FE' },
  { name: 'Krem / Pasir', value: '#F5F5F4' },
  { name: 'Oranye Senja', value: '#FFEDD5' },
];

const EmDash = Extension.create({
  name: 'emDash',
  addInputRules() {
    return [
      textInputRule({
        find: /--$/,
        replace: '—',
      }),
    ];
  },
});

const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        // Cek apakah kursor berada di dalam item daftar (orderedList / bulletList)
        let depth = 0;
        let isInsideList = false;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'orderedList' || node.type.name === 'bulletList') {
            depth++;
            isInsideList = true;
          }
        }

        if (isInsideList) {
          // Batas maksimal subbab 4 level: 1. -> 1.1 -> 1.1.1 -> 1.1.1.1
          if (depth < 4) {
            return this.editor.commands.sinkListItem('listItem');
          }
          return true; // Jangan buat level lebih dalam dari 4
        }

        // Cek jika kursor berada pada baris paragraf yang diawali penomoran (misal: 1. -> Tab -> 1.1 -> Tab -> 1.1.1)
        const lineText = $from.parent.textContent;
        const numberMatch = lineText.match(/^(\d+(?:\.\d+)*)\.?\s*(.*)$/);
        if (numberMatch) {
          const parts = numberMatch[1].split('.');
          if (parts.length < 4) {
            parts.push('1');
            const newPrefix = parts.join('.') + ' ';
            const start = $from.start();
            const fullPrefixMatch = lineText.match(/^(\d+(?:\.\d+)*\.?\s*)/);
            const oldPrefixLen = fullPrefixMatch ? fullPrefixMatch[0].length : 0;
            const newLevel = Math.min(4, parts.length - 1);
            const tr = state.tr
              .replaceWith(start, start + oldPrefixLen, state.schema.text(newPrefix))
              .setNodeMarkup($from.before(), undefined, {
                ...$from.parent.attrs,
                indent: newLevel,
              });
            this.editor.view.dispatch(tr);
            return true;
          }
          return true; // Maksimal 4 level
        }

        // Jika kursor berada di awal paragraf (offset 0), tingkatkan indentasi hierarki
        if ($from.parentOffset === 0 && $from.parent.isTextblock) {
          const currentIndent = $from.parent.attrs.indent || 0;
          if (currentIndent < 4) {
            return this.editor.commands.updateAttributes('paragraph', {
              indent: currentIndent + 1,
            });
          }
          return true;
        }

        // Menyisipkan 4 karakter spasi unicode non-breaking space untuk paragraf biasa di tengah teks
        return this.editor.commands.insertContent('\u00a0\u00a0\u00a0\u00a0');
      },
      'Shift-Tab': () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        const { $from } = selection;

        // Jika berada di dalam list item, kembalikan ke level sebelumnya (outdent)
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'orderedList' || node.type.name === 'bulletList') {
            return this.editor.commands.liftListItem('listItem');
          }
        }

        // Cek jika berada pada baris penomoran bertingkat (misal: 1.1.1 -> Shift-Tab -> 1.1 -> Shift-Tab -> 1.)
        const lineText = $from.parent.textContent;
        const numberMatch = lineText.match(/^(\d+(?:\.\d+)*)\.?\s*(.*)$/);
        if (numberMatch) {
          const parts = numberMatch[1].split('.');
          const fullPrefixMatch = lineText.match(/^(\d+(?:\.\d+)*\.?\s*)/);
          const oldPrefixLen = fullPrefixMatch ? fullPrefixMatch[0].length : 0;
          if (parts.length > 2) {
            parts.pop();
            const newPrefix = parts.join('.') + ' ';
            const start = $from.start();
            const newLevel = Math.min(4, parts.length - 1);
            const tr = state.tr
              .replaceWith(start, start + oldPrefixLen, state.schema.text(newPrefix))
              .setNodeMarkup($from.before(), undefined, {
                ...$from.parent.attrs,
                indent: newLevel,
              });
            dispatch(tr);
            return true;
          } else if (parts.length === 2) {
            // 1.1 -> Shift-Tab -> 1.
            const newPrefix = parts[0] + '. ';
            const start = $from.start();
            const tr = state.tr
              .replaceWith(start, start + oldPrefixLen, state.schema.text(newPrefix))
              .setNodeMarkup($from.before(), undefined, {
                ...$from.parent.attrs,
                indent: 0,
              });
            dispatch(tr);
            return true;
          } else if (parts.length === 1) {
            // 1. -> Shift-Tab -> hapus prefix penomoran
            const start = $from.start();
            const tr = state.tr
              .delete(start, start + oldPrefixLen)
              .setNodeMarkup($from.before(), undefined, {
                ...$from.parent.attrs,
                indent: 0,
              });
            dispatch(tr);
            return true;
          }
        }

        // Jika paragraf memiliki indentasi hierarki > 0, kurangi level indentasi (outdent ke atasnya)
        const currentIndent = $from.parent.attrs.indent || 0;
        if (currentIndent > 0) {
          return this.editor.commands.updateAttributes('paragraph', {
            indent: currentIndent - 1,
          });
        }

        // Jika paragraf memiliki format hanging indent (daftar pustaka), kembalikan ke paragraf normal
        if ($from.parent.attrs.hangingIndent) {
          const tr = state.tr.setNodeMarkup($from.before($from.depth), undefined, {
            ...$from.parent.attrs,
            hangingIndent: false,
          });
          dispatch(tr);
          return true;
        }

        const lineStart = $from.start();
        const textBefore = $from.parent.textBetween(0, $from.parentOffset);
        const match = textBefore.match(/^[\u00a0 ]{1,4}/);
        if (match) {
          const tr = state.tr.delete(lineStart, lineStart + match[0].length);
          dispatch(tr);
          return true;
        }
        return false;
      },
      Backspace: () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        const { empty, $from } = selection;
        if (!empty) return false;

        // Jika berada di awal paragraf (offset 0) atau baris kosong yang memiliki format hanging indent (daftar pustaka),
        // hapus format hanging indent terlebih dahulu
        if (
          $from.parent.isTextblock &&
          $from.parentOffset === 0 &&
          $from.parent.attrs.hangingIndent
        ) {
          const tr = state.tr.setNodeMarkup($from.before($from.depth), undefined, {
            ...$from.parent.attrs,
            hangingIndent: false,
          });
          dispatch(tr);
          return true;
        }

        // UX LMS / Typewriter Best Practice:
        // Jika berada di baris kosong dengan perataan teks bukan kiri (misal: judul di tengah lalu tekan enter),
        // menekan tombol Backspace pertama langsung mengembalikan kursor dan perataan ke kiri (justify left), bukan naik ke atas.
        if (
          $from.parent.isTextblock &&
          $from.parent.content.size === 0 &&
          $from.parent.attrs.textAlign &&
          $from.parent.attrs.textAlign !== 'left'
        ) {
          return this.editor.commands.setTextAlign('left');
        }

        const parentOffset = $from.parentOffset;
        if (parentOffset === 0) return false;

        // Ambil teks sebelum posisi kursor dalam node teks saat ini
        const textBefore = $from.parent.textBetween(
          Math.max(0, parentOffset - 4),
          parentOffset
        );

        // Jika tepat sebelum kursor ada 4 karakter indentasi (\u00a0 maupun spasi biasa)
        if (
          textBefore === '\u00a0\u00a0\u00a0\u00a0' ||
          textBefore === '    ' ||
          /^[\u00a0 ]{4}$/.test(textBefore)
        ) {
          const tr = state.tr.delete($from.pos - 4, $from.pos);
          dispatch(tr);
          return true;
        }

        // Jika kursor berada di awal paragraf dengan sisa 1-3 spasi indentasi
        if (parentOffset <= 4) {
          const leadingText = $from.parent.textBetween(0, parentOffset);
          if (/^[\u00a0 ]+$/.test(leadingText)) {
            const tr = state.tr.delete($from.pos - leadingText.length, $from.pos);
            dispatch(tr);
            return true;
          }
        }

        return false;
      },
    };
  },
});

const CustomHighlight = Highlight.extend({
  inclusive: false,
  addAttributes() {
    return {
      'data-pesan': {
        default: null,
        parseHTML: element => element.getAttribute('data-pesan'),
        renderHTML: attributes => {
          if (!attributes['data-pesan']) {
            return {};
          }
          return {
            'data-pesan': attributes['data-pesan'],
          };
        },
      },
      'data-tag': {
        default: null,
        parseHTML: element => element.getAttribute('data-tag'),
        renderHTML: attributes => {
          if (!attributes['data-tag']) {
            return {};
          }
          return {
            'data-tag': attributes['data-tag'],
          };
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('preventHighlightDragging'),
        props: {
          handleTextInput(view, from, to, text) {
            const { state } = view;
            const marks = state.storedMarks || state.selection.$from.marks();
            if (marks && marks.some(m => m.type.name === 'highlight')) {
              const cleanMarks = marks.filter(m => m.type.name !== 'highlight');
              const tr = state.tr.replaceWith(from, to, state.schema.text(text, cleanMarks));
              tr.setStoredMarks(cleanMarks);
              view.dispatch(tr);
              return true;
            }
            return false;
          },
        },
        appendTransaction(_transactions, _oldState, newState) {
          const { selection } = newState;
          if (selection.empty) {
            const marks = newState.storedMarks || selection.$from.marks();
            if (marks && marks.some(m => m.type.name === 'highlight')) {
              const cleanMarks = marks.filter(m => m.type.name !== 'highlight');
              const tr = newState.tr;
              tr.setStoredMarks(cleanMarks);
              return tr;
            }
          }
          return null;
        },
      }),
    ];
  },
});

const FootnoteNode = TipTapNode.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-footnote-id'),
        renderHTML: (attributes) => ({
          'data-footnote-id': attributes.id,
        }),
      },
      text: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-footnote-text') || '',
        renderHTML: (attributes) => ({
          'data-footnote-text': attributes.text,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-footnote-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'nulis-footnote-ref',
        title: HTMLAttributes['data-footnote-text'] || '',
        contenteditable: 'false',
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, dispatch } = this.editor.view;
        const { selection, tr } = state;
        if (selection instanceof TextSelection && selection.empty) {
          const { $from } = selection;
          const nodeBefore = $from.nodeBefore;
          if (nodeBefore && nodeBefore.type.name === 'footnote') {
            tr.delete($from.pos - nodeBefore.nodeSize, $from.pos);
            dispatch(tr.scrollIntoView());
            return true;
          }
        }
        return false;
      },
      Delete: () => {
        const { state, dispatch } = this.editor.view;
        const { selection, tr } = state;
        if (selection instanceof TextSelection && selection.empty) {
          const { $from } = selection;
          const nodeAfter = $from.nodeAfter;
          if (nodeAfter && nodeAfter.type.name === 'footnote') {
            tr.delete($from.pos, $from.pos + nodeAfter.nodeSize);
            dispatch(tr.scrollIntoView());
            return true;
          }
        }
        return false;
      },
    };
  },
});

function insertPageBreakHelper(view: { state: any; dispatch: (tr: any) => void }): boolean {
  const { state, dispatch } = view;
  const { tr, schema } = state;
  const { selection } = tr;
  const { $from, empty } = selection;

  if (!empty) {
    tr.deleteSelection();
  }

  const pageBreakType = schema.nodes.pageBreak;
  if (!pageBreakType) return false;

  const pageBreakNode = pageBreakType.create();
  const pNode = schema.nodes.paragraph.create();

  if ($from.parent.isTextblock) {
    const parentOffset = $from.parentOffset;
    const parentContentSize = $from.parent.content.size;

    if (parentOffset === 0 && parentContentSize === 0) {
      // Baris kosong: ganti baris ini dengan pageBreak diikuti paragraf baru di halaman berikutnya
      const blockStart = $from.before($from.depth);
      const blockEnd = $from.after($from.depth);
      if (blockStart === 0) {
        // Jika baris kosong berada di awal dokumen (halaman 1), pertahankan paragraf di halaman 1
        const p1 = schema.nodes.paragraph.create();
        const p2 = schema.nodes.paragraph.create();
        tr.replaceWith(0, blockEnd, [p1, pageBreakNode, p2]);
        const newPPos = p1.nodeSize + pageBreakNode.nodeSize + 1;
        tr.setSelection(TextSelection.create(tr.doc, newPPos));
      } else {
        tr.replaceWith(blockStart, blockEnd, [pageBreakNode, pNode]);
        const newPPos = blockStart + pageBreakNode.nodeSize + 1;
        tr.setSelection(TextSelection.create(tr.doc, newPPos));
      }
    } else if (parentOffset === parentContentSize) {
      // Di akhir paragraf: sisipkan pageBreak dan paragraf baru setelahnya
      const posAfterBlock = $from.after($from.depth);
      tr.insert(posAfterBlock, [pageBreakNode, pNode]);
      const newPPos = posAfterBlock + pageBreakNode.nodeSize + 1;
      tr.setSelection(TextSelection.create(tr.doc, newPPos));
    } else if (parentOffset === 0) {
      // Di awal paragraf non-kosong: dorong seluruh paragraf ke halaman berikutnya
      const posBeforeBlock = $from.before($from.depth);
      if (posBeforeBlock === 0) {
        // Jika menyisipkan halaman baru di awal dokumen (halaman 1),
        // sisipkan paragraf kosong di halaman 1 agar kursor bisa masuk dan mengetik di halaman 1!
        const p1 = schema.nodes.paragraph.create();
        tr.insert(0, [p1, pageBreakNode]);
        const newPos = p1.nodeSize + pageBreakNode.nodeSize + 1;
        tr.setSelection(TextSelection.create(tr.doc, newPos));
      } else {
        tr.insert(posBeforeBlock, pageBreakNode);
        const newPos = posBeforeBlock + pageBreakNode.nodeSize + 1;
        tr.setSelection(TextSelection.create(tr.doc, newPos));
      }
    } else {
      // Di tengah teks: pecah paragraf di posisi kursor, sisipkan pageBreak di antaranya
      const currentPos = $from.pos;
      tr.split(currentPos);
      const insertPos = currentPos + 1;
      tr.insert(insertPos, pageBreakNode);
      const targetPos = insertPos + pageBreakNode.nodeSize + 1;
      tr.setSelection(TextSelection.create(tr.doc, targetPos));
    }
  } else {
    tr.replaceSelectionWith(pageBreakNode);
    const insertPos = tr.selection.to;
    tr.insert(insertPos, pNode);
    tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
  }

  dispatch(tr.scrollIntoView());
  return true;
}

const PageBreakNode = TipTapNode.create({
  name: 'pageBreak',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,

  parseHTML() {
    return [
      { tag: 'div[data-page-break]' },
      { tag: 'hr[data-page-break]' },
      { tag: 'div.nulis-page-break' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': 'true',
        class: 'nulis-page-break',
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => {
        return insertPageBreakHelper(this.editor.view);
      },
      Backspace: () => {
        const { state, dispatch } = this.editor.view;
        const { selection, tr, doc } = state;

        if (selection instanceof NodeSelection && selection.node.type.name === 'pageBreak') {
          tr.delete(selection.from, selection.to);
          dispatch(tr.scrollIntoView());
          return true;
        }

        if (selection instanceof TextSelection && selection.empty) {
          const { $from } = selection;

          if ($from.parentOffset === 0) {
            const posBeforeBlock = $from.before($from.depth);
            const $before = doc.resolve(posBeforeBlock);
            const nodeBefore = $before.nodeBefore;

            if (nodeBefore && nodeBefore.type.name === 'pageBreak') {
              const pageBreakPos = posBeforeBlock - nodeBefore.nodeSize;

              if ($from.parent.content.size === 0) {
                const currentBlockEnd = $from.after($from.depth);
                tr.delete(pageBreakPos, currentBlockEnd);
                const targetPos = Math.max(0, pageBreakPos);
                tr.setSelection(Selection.near(tr.doc.resolve(targetPos), -1));
              } else {
                tr.delete(pageBreakPos, posBeforeBlock);
              }
              dispatch(tr.scrollIntoView());
              return true;
            }
          }

          const directNodeBefore = $from.nodeBefore;
          if (directNodeBefore && directNodeBefore.type.name === 'pageBreak') {
            const pageBreakPos = $from.pos - directNodeBefore.nodeSize;
            tr.delete(pageBreakPos, $from.pos);
            dispatch(tr.scrollIntoView());
            return true;
          }
        }
        return false;
      },
      Delete: () => {
        const { state, dispatch } = this.editor.view;
        const { selection, tr, doc } = state;

        if (selection instanceof NodeSelection && selection.node.type.name === 'pageBreak') {
          tr.delete(selection.from, selection.to);
          dispatch(tr.scrollIntoView());
          return true;
        }

        if (selection instanceof TextSelection && selection.empty) {
          const { $from } = selection;
          if ($from.parentOffset === $from.parent.content.size) {
            const posAfterBlock = $from.after($from.depth);
            const $after = doc.resolve(posAfterBlock);
            const nodeAfter = $after.nodeAfter;

            if (nodeAfter && nodeAfter.type.name === 'pageBreak') {
              const pageBreakEnd = posAfterBlock + nodeAfter.nodeSize;
              const $afterPageBreak = doc.resolve(pageBreakEnd);
              const nextBlock = $afterPageBreak.nodeAfter;

              if (nextBlock && nextBlock.isTextblock && nextBlock.content.size === 0) {
                tr.delete(posAfterBlock, pageBreakEnd + nextBlock.nodeSize);
              } else {
                tr.delete(posAfterBlock, pageBreakEnd);
              }
              dispatch(tr.scrollIntoView());
              return true;
            }
          }

          const directNodeAfter = $from.nodeAfter;
          if (directNodeAfter && directNodeAfter.type.name === 'pageBreak') {
            tr.delete($from.pos, $from.pos + directNodeAfter.nodeSize);
            dispatch(tr.scrollIntoView());
            return true;
          }
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pageBreakFirstChildGuard'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (newState.doc.firstChild && newState.doc.firstChild.type.name === 'pageBreak') {
            return newState.tr.insert(0, newState.schema.nodes.paragraph.create());
          }
          return null;
        },
      }),
    ];
  },
});

function toggleHangingIndentHelper(view: any): boolean {
  if (!view) return false;
  const { state, dispatch } = view;
  const { selection } = state;
  const { from, to } = selection;

  let hasAnyHanging = false;
  const paragraphs: Array<{ pos: number; node: any }> = [];

  state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (node.type.name === 'paragraph') {
      paragraphs.push({ pos, node });
      if (node.attrs.hangingIndent) {
        hasAnyHanging = true;
      }
    }
  });

  if (paragraphs.length === 0) {
    const $from = selection.$from;
    if ($from.parent && $from.parent.type.name === 'paragraph') {
      const pos = $from.before($from.depth);
      paragraphs.push({ pos, node: $from.parent });
      if ($from.parent.attrs.hangingIndent) {
        hasAnyHanging = true;
      }
    }
  }

  if (paragraphs.length === 0) return false;

  const targetState = !hasAnyHanging;
  let tr = state.tr;
  for (const item of paragraphs) {
    tr = tr.setNodeMarkup(item.pos, undefined, {
      ...item.node.attrs,
      hangingIndent: targetState,
    });
  }

  dispatch(tr.scrollIntoView());
  return true;
}

const HangingIndent = Extension.create({
  name: 'hangingIndent',
  addKeyboardShortcuts() {
    return {
      'Alt-t': () => toggleHangingIndentHelper(this.editor.view),
      'Alt-T': () => toggleHangingIndentHelper(this.editor.view),
      'Alt-g': () => toggleHangingIndentHelper(this.editor.view),
      'Alt-G': () => toggleHangingIndentHelper(this.editor.view),
      'Mod-t': () => toggleHangingIndentHelper(this.editor.view),
      'Mod-T': () => toggleHangingIndentHelper(this.editor.view),
      'Mod-Shift-t': () => toggleHangingIndentHelper(this.editor.view),
      'Mod-Shift-T': () => toggleHangingIndentHelper(this.editor.view),
    };
  },
});

const DocTocComponent: React.FC<any> = ({ node, editor, deleteNode }) => {
  const [headings, setHeadings] = useState<Array<{ id: string; level: number; text: string; page: number; pos: number }>>(() => {
    return node?.attrs?.headings && Array.isArray(node.attrs.headings) && node.attrs.headings.length > 0
      ? node.attrs.headings
      : editor?.storage?.docToc?.headings || [];
  });

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const stored = editor.storage?.docToc?.headings || node?.attrs?.headings;
      if (stored && Array.isArray(stored)) {
        setHeadings(stored);
      }
    };
    sync();
    editor.on('update', sync);
    editor.on('transaction', sync);
    return () => {
      editor.off('update', sync);
      editor.off('transaction', sync);
    };
  }, [editor, node]);

  const handleJump = (pos: number) => {
    if (!editor) return;
    try {
      editor.chain().focus().setTextSelection(pos + 1).run();
      const dom = editor.view.nodeDOM(pos);
      if (dom && dom instanceof HTMLElement) {
        dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const coords = editor.view.coordsAtPos(pos);
        if (coords) {
          window.scrollTo({
            top: window.scrollY + coords.top - 120,
            behavior: 'smooth',
          });
        }
      }
    } catch {}
  };

  return (
    <NodeViewWrapper className="nulis-doc-toc-wrapper my-6 select-none">
      <div className="nulis-doc-toc relative group py-2">
        {/* Tombol Aksi Hapus di pojok kanan atas blok */}
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10 bg-white/90 dark:bg-stone-850/90 px-2 py-1 rounded-md border border-stone-200 dark:border-stone-700 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            Daftar Isi
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            className="text-stone-400 hover:text-red-600 dark:hover:text-red-400 p-0.5 rounded cursor-pointer transition-colors"
            title="Hapus Daftar Isi dari Dokumen"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="nulis-doc-toc-title text-center text-base sm:text-lg font-bold tracking-widest uppercase pb-2 mb-6 border-b border-stone-900 dark:border-stone-300 text-stone-900 dark:text-stone-100 font-serif-literary">
          DAFTAR ISI
        </div>

        {headings.length === 0 ? (
          <div className="py-4 text-center text-xs text-stone-500 dark:text-stone-400 font-serif-literary italic">
            Belum ada judul bab terdeteksi. Susun bab menggunakan format Heading 1, 2, atau 3 (H1, H2, H3).
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 font-serif-literary">
            {headings.map((h: any) => {
              const indent =
                h.level === 1
                  ? 'font-bold text-stone-900 dark:text-stone-100 pl-0 text-sm'
                  : h.level === 2
                  ? 'font-medium text-stone-800 dark:text-stone-200 pl-4 text-xs'
                  : 'font-normal text-stone-600 dark:text-stone-400 pl-8 text-xs';

              return (
                <div
                  key={h.id}
                  onClick={() => handleJump(h.pos)}
                  className={`nulis-doc-toc-row flex items-baseline justify-between py-1 cursor-pointer transition-opacity hover:opacity-75 group/item ${indent}`}
                  title={`Klik untuk melompat ke "${h.text}"`}
                >
                  <span className="truncate mr-2">
                    {h.text}
                  </span>
                  <span className="nulis-doc-toc-dots flex-1" />
                  <span className="nulis-doc-toc-num shrink-0">
                    {h.page}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

const DocTocNode = TipTapNode.create({
  name: 'docToc',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      headings: {
        default: [],
        parseHTML: (element) => {
          try {
            return JSON.parse(element.getAttribute('data-headings') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          'data-headings': JSON.stringify(attributes.headings || []),
        }),
      },
    };
  },

  addStorage() {
    return {
      headings: [] as Array<{ id: string; level: number; text: string; page: number; pos: number }>,
      updatedAt: 0,
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-doc-toc]' },
      { tag: 'div.nulis-doc-toc-wrapper' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const headings = (node.attrs.headings as Array<{ id: string; level: number; text: string; page: number }>) || [];
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-doc-toc': 'true',
        class: 'nulis-doc-toc',
        contenteditable: 'false',
      }),
      ['div', { class: 'nulis-doc-toc-title' }, 'DAFTAR ISI'],
      [
        'div',
        { class: 'nulis-doc-toc-content' },
        ...headings.map((h) => [
          'div',
          { class: `nulis-doc-toc-row level-${h.level}`, 'data-level': String(h.level), 'data-page': String(h.page) },
          ['span', { class: 'nulis-doc-toc-text' }, h.text],
          ['span', { class: 'nulis-doc-toc-dots' }],
          ['span', { class: 'nulis-doc-toc-num' }, String(h.page)],
        ]),
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DocTocComponent);
  },
});

// AutoPagination Extension: Menghitung akumulasi baris naskah (~34 baris standar ideal halaman naskah A4),
// memisahkan lembaran kertas A4, menempatkan nomor halaman di footer (angka saja), serta catatan kaki pada halaman bersangkutan.
interface AutoPaginationOptions {
  getLayoutMode: () => 'web' | 'kertas';
  linesPerPage: number;
  onEditFootnote?: (fn: { id: string; text: string }) => void;
  onPaginationUpdate?: (data: {
    breakPoints: AutoPaginationBreakPoint[];
    pageFootnotes: Record<number, Array<{ id: string; text: string; index: number }>>;
    totalPages: number;
  }) => void;
}

interface AutoPaginationBreakPoint {
  offset: number;
  fromPage: number;
  toPage: number;
  spacerLines?: number;
  isTableRowBreak?: boolean;
  tableColCount?: number;
}

interface AutoPaginationData {
  breakPoints: AutoPaginationBreakPoint[];
  pageFootnotes: Record<number, Array<{ id: string; text: string; index: number }>>;
  totalPages: number;
}

// Helper penghitungan statistik kata & karakter yang akurat.
// textContent ProseMirror menggabungkan teks tanpa spasi (<p>a</p><p>b</p> -> "ab").
// textBetween(..., ' ', ' ') menyisipkan spasi antar blok sehingga kata pada baris baru (Enter) terhitung akurat!
function computeDocumentStats(doc: any): { words: number; characters: number } {
  if (!doc) return { words: 0, characters: 0 };
  const fullText = doc.textBetween(0, doc.content.size, ' ', ' ');
  const clean = fullText.trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  const characters = doc.textContent.length;
  return { words, characters };
}

function computeAutoPagination(doc: any, linesPerPage: number): AutoPaginationData {
  let currentLineCount = 0;
  let currentPage = 1;
  const threshold = linesPerPage || 34;

  const pageFootnotes: Record<number, Array<{ id: string; text: string; index: number }>> = {};
  let globalFootnoteIndex = 1;
  const breakPoints: AutoPaginationBreakPoint[] = [];

  doc.forEach((node: any, offset: number) => {
    if (node.type.name === 'pageBreak') {
      const remainingLines = Math.max(0, threshold - currentLineCount);
      breakPoints.push({
        offset,
        fromPage: currentPage,
        toPage: currentPage + 1,
        spacerLines: remainingLines,
      });
      currentPage++;
      currentLineCount = 0;
      return;
    }

    if (node.isTextblock) {
      node.forEach((child: any) => {
        if (child.type.name === 'footnote') {
          const id = (child.attrs && child.attrs.id) || `fn-${globalFootnoteIndex}`;
          const text = (child.attrs && child.attrs.text) || '';
          if (!pageFootnotes[currentPage]) {
            pageFootnotes[currentPage] = [];
          }
          pageFootnotes[currentPage].push({
            id,
            text,
            index: globalFootnoteIndex,
          });
          globalFootnoteIndex++;
        }
      });

      const len = node.textContent.length;
      let estimatedLines = Math.max(1, Math.ceil(len / 85));
      if (node.type.name === 'heading') {
        const level = (node.attrs && node.attrs.level) || 1;
        estimatedLines = level === 1 ? Math.max(2, Math.ceil(estimatedLines * 1.8)) : Math.max(1.5, Math.ceil(estimatedLines * 1.4));
      }
      estimatedLines += 0.4;

      const existingFns = pageFootnotes[currentPage]?.length || 0;
      const fnReservedLines = existingFns > 0 ? (2.0 + existingFns * 1.5) : 0;
      const effectiveThreshold = Math.max(12, threshold - fnReservedLines);

      if (currentLineCount + estimatedLines >= effectiveThreshold && offset > 0) {
        breakPoints.push({
          offset,
          fromPage: currentPage,
          toPage: currentPage + 1,
        });
        currentPage++;
        currentLineCount = estimatedLines;
      } else {
        currentLineCount += estimatedLines;
      }
    } else if (node.type.name === 'table') {
      // Hitung jumlah kolom tabel secara akurat dari seluruh baris
      let tableColCount = 1;
      node.forEach((r: any) => {
        let rCols = 0;
        r.forEach((c: any) => {
          rCols += (Number(c.attrs?.colspan) || 1);
        });
        if (rCols > tableColCount) tableColCount = rCols;
      });

      // Pemotongan halaman tabel bersambung:
      // Baris-baris awal tetap di halaman saat ini, dan ketika baris tabel melebihi batas halaman,
      // tabel terpotong di batas baris tersebut dan dilanjutkan di halaman berikutnya.
      node.forEach((row: any, rowOffset: number, rowIndex: number) => {
        const rowLen = row.textContent.length;
        const rowEstimatedLines = rowLen > 80 ? Math.max(2.2, Math.ceil(rowLen / 50)) : 2.2;
        const rowPos = offset + 1 + rowOffset;

        // Ruang footnote yang telah terdaftar di halaman saat ini
        const existingFns = pageFootnotes[currentPage]?.length || 0;
        const fnReservedLines = existingFns > 0 ? (2.0 + existingFns * 1.5) : 0;
        const effectiveThreshold = Math.max(10, threshold - fnReservedLines);

        if (rowIndex === 0) {
          // Hanya jika halaman saat ini sudah sangat penuh di awal tabel
          if (currentLineCount + Math.max(2.0, rowEstimatedLines) >= effectiveThreshold && offset > 0) {
            breakPoints.push({
              offset,
              fromPage: currentPage,
              toPage: currentPage + 1,
            });
            currentPage++;
            currentLineCount = rowEstimatedLines;
          } else {
            currentLineCount += rowEstimatedLines;
          }
        } else {
          // Baris-baris berikutnya: jika melebihi batas halaman, potong tabel di baris ini dan lanjutkan di halaman baru!
          if (currentLineCount + rowEstimatedLines >= effectiveThreshold) {
            breakPoints.push({
              offset: rowPos,
              fromPage: currentPage,
              toPage: currentPage + 1,
              isTableRowBreak: true,
              tableColCount,
            });
            currentPage++;
            currentLineCount = rowEstimatedLines;
          } else {
            currentLineCount += rowEstimatedLines;
          }
        }

        // Catat seluruh footnote pada baris tabel ini ke halaman tempat baris ini berada
        row.descendants((child: any) => {
          if (child.type.name === 'footnote') {
            const id = (child.attrs && child.attrs.id) || `fn-${globalFootnoteIndex}`;
            const text = (child.attrs && child.attrs.text) || '';
            if (!pageFootnotes[currentPage]) {
              pageFootnotes[currentPage] = [];
            }
            pageFootnotes[currentPage].push({
              id,
              text,
              index: globalFootnoteIndex,
            });
            globalFootnoteIndex++;
          }
        });
      });
    } else {
      currentLineCount += 2;
    }
  });

  return {
    breakPoints,
    pageFootnotes,
    totalPages: currentPage,
  };
}

interface AutoPaginationPluginState extends AutoPaginationData {
  version: number;
}

const autoPaginationPluginKey = new PluginKey<AutoPaginationPluginState>('autoPagination');

const AutoPagination = Extension.create<AutoPaginationOptions>({
  name: 'autoPagination',
  addOptions() {
    return {
      getLayoutMode: () => 'web' as 'web' | 'kertas',
      linesPerPage: 34,
      onEditFootnote: undefined,
      onPaginationUpdate: undefined,
    };
  },
  addProseMirrorPlugins() {
    const { options } = this;
    return [
      new Plugin<AutoPaginationPluginState>({
        key: autoPaginationPluginKey,
        state: {
          init(_, state) {
            const pagination = computeAutoPagination(state.doc, options.linesPerPage || 34);
            return {
              version: 1,
              ...pagination,
            };
          },
          apply(tr, prev, _oldState, newState) {
            if (tr.docChanged || tr.getMeta('layoutModeChanged')) {
              const pagination = computeAutoPagination(newState.doc, options.linesPerPage || 34);
              return {
                version: prev.version + 1,
                ...pagination,
              };
            }
            return prev;
          },
        },
        view(view) {
          if (options.onPaginationUpdate) {
            const initialPluginState = autoPaginationPluginKey.getState(view.state);
            if (initialPluginState) {
              options.onPaginationUpdate({
                breakPoints: initialPluginState.breakPoints,
                pageFootnotes: initialPluginState.pageFootnotes,
                totalPages: initialPluginState.totalPages,
              });
            }
          }
          return {
            update(view, prevState) {
              const currentPluginState = autoPaginationPluginKey.getState(view.state);
              const prevPluginState = prevState ? autoPaginationPluginKey.getState(prevState) : null;
              if (
                currentPluginState &&
                (!prevPluginState || currentPluginState.version !== prevPluginState.version)
              ) {
                if (options.onPaginationUpdate) {
                  options.onPaginationUpdate({
                    breakPoints: currentPluginState.breakPoints,
                    pageFootnotes: currentPluginState.pageFootnotes,
                    totalPages: currentPluginState.totalPages,
                  });
                }
              }
            },
          };
        },
        props: {
          decorations(state) {
            const isKertas = options.getLayoutMode() === 'kertas';
            if (!isKertas) {
              return DecorationSet.empty;
            }

            const pluginState = autoPaginationPluginKey.getState(state);
            if (!pluginState || !pluginState.breakPoints.length) {
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];

            const renderFooterAndGap = (fromPage: number) => {
              const frag = document.createDocumentFragment();

              // 1. Footer dari halaman fromPage (berisi footnote & nomor halaman)
              const footerEl = document.createElement('div');
              footerEl.className = 'nulis-page-footer';

              const fns = pluginState.pageFootnotes[fromPage];
              if (fns && fns.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'nulis-page-footer-divider';
                footerEl.appendChild(divider);

                const listEl = document.createElement('div');
                listEl.className = 'flex flex-col gap-0.5 mb-1';

                fns.forEach((fn) => {
                  const itemEl = document.createElement('div');
                  itemEl.className = 'nulis-page-footer-item cursor-pointer';
                  itemEl.title = 'Klik untuk mengubah sitasi sumber';

                  const numEl = document.createElement('span');
                  numEl.className = 'font-bold shrink-0 text-[11px] leading-tight';
                  numEl.textContent = `[${fn.index}]`;

                  const textEl = document.createElement('span');
                  textEl.className = 'flex-1 leading-snug text-[11px]';
                  textEl.textContent = fn.text;

                  itemEl.appendChild(numEl);
                  itemEl.appendChild(textEl);

                  itemEl.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (options.onEditFootnote) {
                      options.onEditFootnote({ id: fn.id, text: fn.text });
                    }
                  };

                  listEl.appendChild(itemEl);
                });
                footerEl.appendChild(listEl);
              }

              // Nomor halaman di bagian footer (angka saja, tanpa kata 'Halaman')
              const pageNumEl = document.createElement('div');
              pageNumEl.className = 'nulis-page-footer-num';
              const numSpan = document.createElement('span');
              numSpan.textContent = `${fromPage}`;
              pageNumEl.appendChild(numSpan);
              footerEl.appendChild(pageNumEl);

              frag.appendChild(footerEl);

              // 2. Garis tipis pembatas lembaran kertas A4
              const gapEl = document.createElement('div');
              gapEl.className = 'nulis-page-gap-divider';
              frag.appendChild(gapEl);

              return frag;
            };

            pluginState.breakPoints.forEach((bp) => {
              if (bp.isTableRowBreak) {
                // Multi-page Table Continuation Break
                const trEl = document.createElement('tr');
                trEl.className = 'nulis-table-page-break-row';
                trEl.setAttribute('contenteditable', 'false');

                const tdEl = document.createElement('td');
                tdEl.className = 'nulis-table-page-break-cell';
                tdEl.setAttribute('colspan', String(bp.tableColCount || 1));
                tdEl.setAttribute('contenteditable', 'false');

                const wrapper = document.createElement('div');
                wrapper.className = 'nulis-table-break-content';
                wrapper.appendChild(renderFooterAndGap(bp.fromPage));

                tdEl.appendChild(wrapper);
                trEl.appendChild(tdEl);

                decorations.push(
                  Decoration.widget(bp.offset, trEl, {
                    side: -1,
                    key: `table-page-boundary-${bp.fromPage}`,
                  })
                );
                return;
              }

              const dom = document.createElement('div');
              dom.className = 'nulis-page-boundary';
              dom.setAttribute('contenteditable', 'false');

              // Spacer agar halaman sebelumnya berukuran sempurna penuh seperti MS Word saat tambah halaman
              if (bp.spacerLines && bp.spacerLines > 0) {
                const spacerEl = document.createElement('div');
                spacerEl.className = 'nulis-page-manual-spacer';
                spacerEl.style.minHeight = `${bp.spacerLines * 1.75}rem`;
                dom.appendChild(spacerEl);
              }

              dom.appendChild(renderFooterAndGap(bp.fromPage));

              decorations.push(
                Decoration.widget(bp.offset, dom, {
                  side: -1,
                  key: `page-boundary-${bp.fromPage}`,
                })
              );
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

const sanitizeContent = (html?: string) => {
  if (!html || html === '<p><br></p>') return '<p></p>';
  return html.replace(/&amp;nbsp;/g, '\u00a0');
};

interface SlashOption {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  keywords: string[];
  action: (editor: any) => void;
}

const SLASH_OPTIONS: SlashOption[] = [
  {
    id: 'paragraph',
    title: 'Teks Biasa',
    subtitle: 'Paragraf',
    icon: <Type size={16} />,
    keywords: ['p', 'paragraf', 'normal', 'teks'],
    action: (editor) => {
      editor.commands.setParagraph();
    },
  },
  {
    id: 'h1',
    title: 'Heading 1',
    subtitle: 'Ukuran besar',
    icon: <Heading1 size={16} />,
    keywords: ['h1', 'judul', 'besar', 'heading1'],
    action: (editor) => {
      editor.commands.toggleHeading({ level: 1 });
    },
  },
  {
    id: 'h2',
    title: 'Heading 2',
    subtitle: 'Ukuran sedang',
    icon: <Heading2 size={16} />,
    keywords: ['h2', 'subjudul', 'sedang', 'heading2'],
    action: (editor) => {
      editor.commands.toggleHeading({ level: 2 });
    },
  },
  {
    id: 'h3',
    title: 'Heading 3',
    subtitle: 'Ukuran kecil',
    icon: <Heading3 size={16} />,
    keywords: ['h3', 'kecil', 'heading3'],
    action: (editor) => {
      editor.commands.toggleHeading({ level: 3 });
    },
  },
  {
    id: 'bullet-list',
    title: 'Daftar Poin',
    subtitle: 'Daftar butir (bullet)',
    icon: <List size={16} />,
    keywords: ['list', 'poin', 'bullet', 'daftar'],
    action: (editor) => {
      editor.commands.toggleBulletList();
    },
  },
  {
    id: 'numbered-list',
    title: 'Daftar Angka',
    subtitle: '1. Penomoran bertingkat',
    icon: <ListOrdered size={16} />,
    keywords: ['angka', 'nomor', 'number', 'ordered', '1', 'subbab'],
    action: (editor) => {
      editor.commands.insertContent('1. ');
    },
  },
  {
    id: 'blockquote',
    title: 'Quote',
    subtitle: 'Format kutipan / blockquote',
    icon: <Quote size={16} />,
    keywords: ['quote', 'kutipan', 'petikan', 'bait', 'blok'],
    action: (editor) => {
      editor.commands.toggleBlockquote();
    },
  },
  {
    id: 'footnote',
    title: 'Catatan Kaki',
    subtitle: 'Footnote & referensi sitasi',
    icon: <BookmarkCheck size={16} />,
    keywords: ['footnote', 'catatan', 'kaki', 'sitasi', 'referensi', 'sumber', 'buku'],
    action: () => {},
  },
  {
    id: 'horizontal-rule',
    title: 'Garis Pemisah',
    subtitle: 'Garis pembatas',
    icon: <Minus size={16} />,
    keywords: ['garis', 'divider', 'pemisah', 'hr'],
    action: (editor) => {
      editor.commands.setHorizontalRule();
    },
  },
  {
    id: 'table',
    title: 'Tabel Data',
    subtitle: 'Tabel 3x3 untuk data penelitian & observasi',
    icon: <TableIcon size={16} />,
    keywords: ['tabel', 'table', 'data', 'grid', 'kolom', 'baris', 'matriks'],
    action: (editor) => {
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
    },
  },
];

export interface TeacherFeedbackOption {
  id: string;
  label: string;
  tag: string;
  template: string;
  keywords: string[];
}

export const TEACHER_FEEDBACK_OPTIONS: TeacherFeedbackOption[] = [
  {
    id: 'kapital',
    label: 'Huruf Kapital',
    tag: '[Huruf Kapital]',
    template: 'Perhatikan penggunaan huruf kapital untuk awal kalimat, nama diri, atau unsur geografi.',
    keywords: ['kapital', 'besar', 'huruf', 'nama', 'awal', 'ka'],
  },
  {
    id: 'imbuhan',
    label: 'Pembentukan Kata',
    tag: '[Pembentukan Kata]',
    template: 'Perhatikan ketepatan penggunaan imbuhan (awalan, akhiran, konfiks) dan bentuk dasar kata.',
    keywords: ['imbuhan', 'kata', 'awalan', 'akhiran', 'afiks', 'prefiks', 'sufiks', 'bentuk', 'pem', 'im'],
  },
  {
    id: 'tanda_baca',
    label: 'Tanda Baca',
    tag: '[Tanda Baca]',
    template: 'Perhatikan ketepatan tanda baca (titik, koma, atau tanda hubung) pada klausa ini.',
    keywords: ['tanda', 'baca', 'koma', 'titik', 'hubung', 'petik', 'ta'],
  },
  {
    id: 'kebakuan',
    label: 'Kebakuan & Ejaan',
    tag: '[Kebakuan & Ejaan]',
    template: 'Gunakan kata baku sesuai KBBI dan hindari salah ketik (typo).',
    keywords: ['baku', 'ejaan', 'typo', 'saltik', 'kbbi', 'ba'],
  },
  {
    id: 'diksi',
    label: 'Ketepatan Diksi',
    tag: '[Ketepatan Diksi]',
    template: 'Pemilihan kata dapat divariasikan agar lebih bernas dan sesuai nada tulisan.',
    keywords: ['diksi', 'kata', 'kosakata', 'pilihan', 'variasi', 'di'],
  },
  {
    id: 'kalimat',
    label: 'Efektivitas Kalimat',
    tag: '[Efektivitas Kalimat]',
    template: 'Kalimat terlalu panjang atau ambigu; pastikan subjek dan predikat jelas serta hemat kata.',
    keywords: ['kalimat', 'efektif', 'sp', 'subjek', 'predikat', 'ambigu', 'ef'],
  },
  {
    id: 'gagasan',
    label: 'Kedalaman Gagasan',
    tag: '[Kedalaman Gagasan]',
    template: 'Gagasan menarik, namun perlu diperkuat dengan argumen, data, atau ilustrasi pendukung.',
    keywords: ['gagasan', 'ide', 'kritis', 'tema', 'bobot', 'orisinal', 'ga'],
  },
  {
    id: 'kohesi',
    label: 'Kepaduan Paragraf',
    tag: '[Kepaduan Paragraf]',
    template: 'Transisi antarkalimat terasa melompat; gunakan kata penghubung logis agar alur mengalir.',
    keywords: ['kohesi', 'koherensi', 'paragraf', 'transisi', 'alir', 'lompat', 'ko'],
  },
  {
    id: 'struktur',
    label: 'Struktur Teks',
    tag: '[Struktur Teks]',
    template: 'Perjelas bagian pembuka, pengembangan isi, atau penutup sesuai jenis teks yang dipelajari.',
    keywords: ['struktur', 'teks', 'pembuka', 'isi', 'penutup', 'orientasi', 'st'],
  },
];

export interface HoverFeedbackData {
  pesan: string;
  kata: string;
  rect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
}

interface NulisEditorProps {
  initialContent: string;
  readOnly?: boolean;
  isTeacher?: boolean;
  onUpdate?: (html: string) => void;
  onHoverFeedback?: (data: HoverFeedbackData | null) => void;
  blockCopyPaste?: boolean;
  placeholder?: string;
  initialLayoutMode?: 'web' | 'kertas';
  onLayoutModeChange?: (mode: 'web' | 'kertas') => void;
}

export const NulisEditor: React.FC<NulisEditorProps> = ({
  initialContent,
  readOnly = false,
  isTeacher = false,
  onUpdate,
  onHoverFeedback,
  blockCopyPaste = false,
  placeholder = 'Tulis di sini...',
  initialLayoutMode,
  onLayoutModeChange,
}) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [showTeacherCommentModal, setShowTeacherCommentModal] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');
  const [cachedSelection, setCachedSelection] = useState<{ from: number; to: number } | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // State Slash Command (/) Rubrik Guru
  const [selectedTeacherTags, setSelectedTeacherTags] = useState<string[]>([]);
  const [teacherSlashOpen, setTeacherSlashOpen] = useState(false);
  const [teacherSlashQuery, setTeacherSlashQuery] = useState('');
  const [teacherSlashSelectedIndex, setTeacherSlashSelectedIndex] = useState(0);
  const teacherSlashItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const teacherSlashDropdownRef = useRef<HTMLDivElement | null>(null);

  const filteredTeacherOptions = React.useMemo(() => {
    if (!teacherSlashQuery.trim()) return TEACHER_FEEDBACK_OPTIONS;
    const q = teacherSlashQuery.toLowerCase().trim();
    return TEACHER_FEEDBACK_OPTIONS.filter((opt) =>
      opt.label.toLowerCase().includes(q) ||
      opt.tag.toLowerCase().includes(q) ||
      opt.keywords.some((kw) => kw.includes(q))
    );
  }, [teacherSlashQuery]);

  // Active Mark Feedback (saat guru mengklik highlight yang sudah ada)
  const [activeMarkFeedback, setActiveMarkFeedback] = useState<{
    pesan: string;
    text: string;
    markElement: HTMLElement | null;
    rect?: DOMRect;
  } | null>(null);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  const [editingFeedbackText, setEditingFeedbackText] = useState('');

  // Slash Command (/) State
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashMenuCoords, setSlashMenuCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [slashRange, setSlashRange] = useState<{ from: number; to: number }>({ from: 0, to: 0 });
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // Refs untuk mengatasi masalah stale closure pada Tiptap event handlers
  const slashRangeRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });
  const slashItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const slashMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);

  // Filtered slash commands based on typed query
  const filteredSlashItems = React.useMemo(() => {
    if (!slashQuery.trim()) return SLASH_OPTIONS;
    const q = slashQuery.toLowerCase();
    return SLASH_OPTIONS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q))
    );
  }, [slashQuery]);

  // State & Navigasi Daftar Isi (Table of Contents / Outline Bab)
  const [isTocOpen, setIsTocOpen] = useState(false);
  const tocDrawerRef = useRef<HTMLDivElement | null>(null);
  const tocToggleBtnRef = useRef<HTMLButtonElement | null>(null);

  // Tutup panel kerangka bab saat mengklik di luar area drawer (UX principle)
  useEffect(() => {
    if (!isTocOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        tocDrawerRef.current &&
        !tocDrawerRef.current.contains(target) &&
        tocToggleBtnRef.current &&
        !tocToggleBtnRef.current.contains(target)
      ) {
        setIsTocOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTocOpen]);

  const [tocHeadings, setTocHeadings] = useState<Array<{
    id: string;
    level: number;
    text: string;
    pos: number;
    page: number;
  }>>([]);

  const updateTocHeadings = (editorInstance: any) => {
    if (!editorInstance) return;
    const list: Array<{ id: string; level: number; text: string; pos: number; page: number }> = [];
    editorInstance.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        const text = node.textContent.trim();
        if (text) {
          let page = 1;
          const bps = paginationDataRef.current?.breakPoints || [];
          for (const bp of bps) {
            if (pos >= bp.offset) {
              page = bp.toPage;
            } else {
              break;
            }
          }
          list.push({
            id: `heading-${pos}`,
            level: node.attrs.level || 1,
            text,
            pos,
            page,
          });
        }
      }
    });
    setTocHeadings(list);
    if (editorInstance.storage?.docToc) {
      editorInstance.storage.docToc.headings = list;
      editorInstance.storage.docToc.updatedAt = Date.now();
    }

    // Sinkronisasi data heading ke attribute node docToc agar otomatis terserialisasi ke getHTML()
    let tr = editorInstance.state.tr;
    let docChanged = false;
    editorInstance.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'docToc') {
        const currentHeadings = node.attrs.headings || [];
        if (JSON.stringify(currentHeadings) !== JSON.stringify(list)) {
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            headings: list,
          });
          docChanged = true;
        }
      }
    });
    if (docChanged) {
      editorInstance.view.dispatch(tr);
    }
  };

  // Status keberadaan Daftar Isi Halaman Depan di naskah
  const [hasDocToc, setHasDocToc] = useState<boolean>(false);

  const checkForDocToc = (editorInstance: any) => {
    if (!editorInstance) return false;
    let found = false;
    editorInstance.state.doc.descendants((node: any) => {
      if (node.type.name === 'docToc') {
        found = true;
        return false;
      }
    });
    return found;
  };

  const insertFrontDocToc = () => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    if (checkForDocToc(currentEditor)) {
      alert('Daftar isi sudah terpasang di naskah!');
      return;
    }
    // Pasang di posisi 0 (halaman paling depan) diikuti pembatas halaman baru
    currentEditor
      .chain()
      .focus()
      .insertContentAt(0, [
        { type: 'docToc', attrs: { headings: tocHeadings } },
        { type: 'pageBreak' },
      ])
      .run();

    handleLayoutChange('kertas');
    setHasDocToc(true);
  };

  const removeDocToc = () => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    const { tr, doc } = currentEditor.state;
    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'docToc') {
        const nextNode = doc.nodeAt(pos + node.nodeSize);
        if (nextNode && nextNode.type.name === 'pageBreak') {
          tr.delete(pos, pos + node.nodeSize + nextNode.nodeSize);
        } else {
          tr.delete(pos, pos + node.nodeSize);
        }
        return false;
      }
    });
    currentEditor.view.dispatch(tr);
    setHasDocToc(false);
  };

  // State Toolbar Mengambang Khusus Tabel (Selalu terlihat saat cursor di dalam tabel di halaman manapun)
  const [activeTableCoords, setActiveTableCoords] = useState<{ top: number; left: number } | null>(null);
  const [showTableColorMenu, setShowTableColorMenu] = useState<boolean>(false);
  const [tableColorTarget, setTableColorTarget] = useState<'cell' | 'row'>('cell');
  const tableColorMenuRef = useRef<HTMLDivElement | null>(null);

  // Tutup menu palet warna tabel saat mengklik di luar area menu
  useEffect(() => {
    if (!showTableColorMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tableColorMenuRef.current && !tableColorMenuRef.current.contains(e.target as Node)) {
        setShowTableColorMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTableColorMenu]);

  // Fungsi mewarnai latar sel atau baris tabel
  const applyTableColor = (color: string | null) => {
    const curEditor = editorRef.current;
    if (!curEditor) return;

    if (tableColorTarget === 'cell') {
      curEditor.chain().focus().setCellAttribute('backgroundColor', color).run();
    } else {
      // Terapkan ke seluruh sel dalam baris aktif saat ini
      const { state, dispatch } = curEditor.view;
      const { selection } = state;
      const { $from } = selection;

      let rowDepth = -1;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table_row') {
          rowDepth = d;
          break;
        }
      }

      if (rowDepth > 0) {
        const rowNode = $from.node(rowDepth);
        const rowStart = $from.start(rowDepth);
        let tr = state.tr;
        let offset = 0;
        rowNode.forEach((cellNode: any) => {
          const cellPos = rowStart + offset;
          const newAttrs = {
            ...cellNode.attrs,
            backgroundColor: color,
          };
          tr = tr.setNodeMarkup(cellPos, undefined, newAttrs);
          offset += cellNode.nodeSize;
        });
        dispatch(tr);
        curEditor.commands.focus();
      } else {
        curEditor.chain().focus().setCellAttribute('backgroundColor', color).run();
      }
    }
  };

  // State Tombol '+' di Sisi Luar Garis Tabel (Ala Word & Google Docs)
  const [hoverAddBtn, setHoverAddBtn] = useState<{
    type: 'col' | 'row';
    x: number;
    y: number;
    tableStart: number;
    index: number;
    lineStart: { x: number; y: number };
    lineEnd: { x: number; y: number };
  } | null>(null);

  // Fungsi menyisipkan kolom atau baris tabel secara presisi langsung via ProseMirror transaction
  const insertTableColOrRow = (btn: {
    type: 'col' | 'row';
    tableStart: number;
    index: number;
  }) => {
    const curEditor = editorRef.current;
    if (!curEditor) return;
    try {
      const { state, view } = curEditor;
      const safePos = Math.max(0, Math.min(btn.tableStart, state.doc.content.size));
      const resolved = state.doc.resolve(safePos);
      let tableNode: any = null;
      let exactTableStart = -1;

      // 1. Cek ancestor nodes
      for (let d = resolved.depth; d > 0; d--) {
        if (resolved.node(d).type.name === 'table') {
          tableNode = resolved.node(d);
          exactTableStart = resolved.start(d);
          break;
        }
      }

      // 2. Cek nodeAfter
      if (!tableNode && resolved.nodeAfter && resolved.nodeAfter.type.name === 'table') {
        tableNode = resolved.nodeAfter;
        exactTableStart = safePos + 1;
      }

      // 3. Cek nodeBefore
      if (!tableNode && resolved.nodeBefore && resolved.nodeBefore.type.name === 'table') {
        tableNode = resolved.nodeBefore;
        exactTableStart = safePos - resolved.nodeBefore.nodeSize + 1;
      }

      // 4. Fallback jika masih belum ketemu: cari table yang mencakup atau terdekat dengan safePos
      if (!tableNode) {
        state.doc.descendants((node: any, pos: number) => {
          if (tableNode) return false;
          if (node.type.name === 'table') {
            if (safePos >= pos && safePos <= pos + node.nodeSize) {
              tableNode = node;
              exactTableStart = pos + 1;
              return false;
            }
          }
        });
      }

      if (!tableNode || exactTableStart === -1) return;

      const map = TableMap.get(tableNode);
      const tableRect = {
        map,
        tableStart: exactTableStart,
        table: tableNode,
        left: 0,
        top: 0,
        right: map.width,
        bottom: map.height,
      };
      let tr = state.tr;
      if (btn.type === 'col') {
        tr = addColumn(tr, tableRect, btn.index);
      } else {
        tr = addRow(tr, tableRect, btn.index);
      }
      view.dispatch(tr);
      curEditor.commands.focus();
      onUpdateRef.current?.(curEditor.getHTML());
    } catch (err) {
      console.error('Error inserting table row/col:', err);
    }
  };

  // Layout Mode: 'web' (Tampilan Mengalir) vs 'kertas' (Lembaran Kertas Berhalaman A4)
  const [layoutMode, setLayoutMode] = useState<'web' | 'kertas'>(() => {
    if (initialLayoutMode) return initialLayoutMode;
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nulislur_layout_mode') as 'web' | 'kertas') || 'kertas';
    }
    return 'kertas';
  });

  const layoutModeRef = useRef(layoutMode);
  layoutModeRef.current = layoutMode;

  useEffect(() => {
    if (initialLayoutMode && initialLayoutMode !== layoutMode) {
      setLayoutMode(initialLayoutMode);
      layoutModeRef.current = initialLayoutMode;
      if (editorRef.current?.view) {
        const tr = editorRef.current.state.tr.setMeta('layoutModeChanged', true);
        editorRef.current.view.dispatch(tr);
      }
    }
  }, [initialLayoutMode]);

  const handleLayoutChange = (mode: 'web' | 'kertas') => {
    if (layoutMode === mode) return;
    setLayoutMode(mode);
    layoutModeRef.current = mode;
    localStorage.setItem('nulislur_layout_mode', mode);
    onLayoutModeChange?.(mode);
    if (editorRef.current?.view) {
      const tr = editorRef.current.state.tr.setMeta('layoutModeChanged', true);
      editorRef.current.view.dispatch(tr);
    }
  };

  // State Catatan Kaki (Footnotes) & Pagination
  const [footnotes, setFootnotes] = useState<{ id: string; text: string; index: number; top: number }[]>([]);
  const [paginationData, setPaginationData] = useState<{
    breakPoints: AutoPaginationBreakPoint[];
    pageFootnotes: Record<number, Array<{ id: string; text: string; index: number }>>;
    totalPages: number;
  }>({
    breakPoints: [],
    pageFootnotes: {},
    totalPages: 1,
  });

  const paginationDataRef = useRef(paginationData);
  paginationDataRef.current = paginationData;

  const [activePage, setActivePage] = useState<number>(1);
  const footnoteInputRef = useRef<HTMLTextAreaElement | null>(null);

  const lastPaginationDataRef = useRef<string>('');
  const lastEmittedHtmlRef = useRef<string>(sanitizeContent(initialContent));

  // State Status Bar Minimalis (Hanya kata & karakter, tanpa menit baca & tanpa tulisan A4)
  const [editorStats, setEditorStats] = useState<{ words: number; characters: number }>(() => {
    const clean = sanitizeContent(initialContent).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      words: clean ? clean.split(/\s+/).filter(Boolean).length : 0,
      characters: clean.length,
    };
  });

  // State Fitur Cari & Ganti (Find & Replace)
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [findMatches, setFindMatches] = useState<Array<{ from: number; to: number }>>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const showFindReplaceRef = useRef<boolean>(false);
  const hasNavigatedRef = useRef<boolean>(false);

  useEffect(() => {
    showFindReplaceRef.current = showFindReplace;
  }, [showFindReplace]);

  const handleToggleFindReplace = () => {
    setShowFindReplace((prev) => {
      const next = !prev;
      if (next && editorRef.current) {
        const { from, to } = editorRef.current.state.selection;
        if (from !== to && to - from < 80) {
          const selectedText = editorRef.current.state.doc.textBetween(from, to, ' ').trim();
          if (selectedText) {
            setFindQuery(selectedText);
          }
        }
      }
      return next;
    });
  };

  const handleCloseFindReplace = () => {
    setShowFindReplace(false);
    if (editorRef.current) {
      editorRef.current.commands.focus(undefined, { scrollIntoView: false });
    }
  };

  // Auto-fokus tanpa scrolling saat modal Cari & Ganti terbuka
  useEffect(() => {
    if (showFindReplace) {
      if (editorRef.current) {
        const { from, to } = editorRef.current.state.selection;
        if (from !== to && to - from < 80) {
          const selectedText = editorRef.current.state.doc.textBetween(from, to, ' ').trim();
          if (selectedText) {
            setFindQuery(selectedText);
          }
        }
      }
      const timer = setTimeout(() => {
        if (findInputRef.current) {
          findInputRef.current.focus({ preventScroll: true });
          findInputRef.current.select();
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [showFindReplace]);


  // Riwayat Sitasi / Sumber yang Pernah Dikutip
  const [citationHistory, setCitationHistory] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('nulislur_citation_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [footnoteModalState, setFootnoteModalState] = useState<{
    isOpen: boolean;
    isEdit: boolean;
    id: string;
    text: string;
    insertPos?: number;
  }>({
    isOpen: false,
    isEdit: false,
    id: '',
    text: '',
  });

  // Auto-fokus dan posisikan kursor di akhir teks saat modal footnote terbuka
  useEffect(() => {
    if (footnoteModalState.isOpen) {
      const timer = setTimeout(() => {
        if (footnoteInputRef.current) {
          footnoteInputRef.current.focus();
          const len = footnoteInputRef.current.value.length;
          footnoteInputRef.current.setSelectionRange(len, len);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [footnoteModalState.isOpen]);

  const updateFootnotesList = () => {
    if (!editorRef.current?.view?.dom) return;
    const refs = editorRef.current.view.dom.querySelectorAll('.nulis-footnote-ref, [data-footnote-id]');
    if (refs.length === 0) {
      setFootnotes((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const list: { id: string; text: string; index: number; top: number }[] = [];
    const editorRect = editorRef.current.view.dom.getBoundingClientRect();

    refs.forEach((el: Element, idx: number) => {
      const htmlEl = el as HTMLElement;
      const id = htmlEl.getAttribute('data-footnote-id') || `fn-${idx + 1}`;
      const text = htmlEl.getAttribute('data-footnote-text') || htmlEl.getAttribute('title') || '';
      const rect = htmlEl.getBoundingClientRect();
      const top = rect.top - editorRect.top;
      list.push({
        id,
        text,
        index: idx + 1,
        top: Math.max(0, top),
      });
    });

    setFootnotes((prev) => {
      if (
        prev.length === list.length &&
        prev.every((p, i) => p.id === list[i].id && p.text === list[i].text && Math.abs(p.top - list[i].top) < 2)
      ) {
        return prev;
      }
      return list;
    });
  };

  const handleSaveFootnote = () => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    const text = footnoteModalState.text.trim();
    if (!text) {
      alert('Isi catatan kaki tidak boleh kosong!');
      return;
    }

    // Simpan ke riwayat sumber yang pernah dikutip
    try {
      const filtered = citationHistory.filter((item) => item.toLowerCase() !== text.toLowerCase());
      const updated = [text, ...filtered].slice(0, 10);
      localStorage.setItem('nulislur_citation_history', JSON.stringify(updated));
      setCitationHistory(updated);
    } catch {}

    if (footnoteModalState.isEdit) {
      const { doc, tr } = currentEditor.view.state;
      let found = false;
      doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'footnote' && node.attrs.id === footnoteModalState.id) {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            text,
          });
          found = true;
          return false;
        }
      });
      if (found) {
        currentEditor.view.dispatch(tr);
        onUpdateRef.current?.(currentEditor.getHTML());
      }
    } else {
      currentEditor
        .chain()
        .focus()
        .insertContent({
          type: 'footnote',
          attrs: {
            id: footnoteModalState.id || `fn-${Date.now()}`,
            text,
          },
        })
        .run();
    }

    setFootnoteModalState({ isOpen: false, isEdit: false, id: '', text: '' });
    setTimeout(() => {
      updateFootnotesList();
      currentEditor.commands.focus();
    }, 30);
  };

  const handleDeleteFootnote = () => {
    const currentEditor = editorRef.current;
    if (!currentEditor || !footnoteModalState.id) return;
    const { doc, tr } = currentEditor.view.state;
    let found = false;
    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'footnote' && node.attrs.id === footnoteModalState.id) {
        tr.delete(pos, pos + node.nodeSize);
        found = true;
        return false;
      }
    });
    if (found) {
      currentEditor.view.dispatch(tr);
      onUpdateRef.current?.(currentEditor.getHTML());
    }
    setFootnoteModalState({ isOpen: false, isEdit: false, id: '', text: '' });
    setTimeout(() => {
      updateFootnotesList();
      currentEditor.commands.focus();
    }, 30);
  };

  const openNewFootnoteModal = () => {
    if (!editorRef.current) return;
    try {
      const raw = localStorage.getItem('nulislur_citation_history');
      if (raw) setCitationHistory(JSON.parse(raw));
    } catch {}
    const { from } = editorRef.current.state.selection;
    setFootnoteModalState({
      isOpen: true,
      isEdit: false,
      id: `fn-${Date.now()}`,
      text: '',
      insertPos: from,
    });
  };

  const openEditFootnote = (fn: { id: string; text: string }) => {
    try {
      const raw = localStorage.getItem('nulislur_citation_history');
      if (raw) setCitationHistory(JSON.parse(raw));
    } catch {}
    setFootnoteModalState({
      isOpen: true,
      isEdit: true,
      id: fn.id,
      text: fn.text,
    });
  };

  // Synchronous state ref for event handlers
  const slashMenuStateRef = useRef({
    isOpen: false,
    query: '',
    selectedIndex: 0,
    range: { from: 0, to: 0 },
    items: SLASH_OPTIONS,
  });

  slashRangeRef.current = slashRange;
  slashMenuStateRef.current = {
    isOpen: slashMenuOpen,
    query: slashQuery,
    selectedIndex: slashSelectedIndex,
    range: slashRange,
    items: filteredSlashItems,
  };

  const isExecutingSlashRef = useRef(false);

  const executeSlashOption = (item: SlashOption) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    if (isExecutingSlashRef.current) return;
    isExecutingSlashRef.current = true;
    setTimeout(() => {
      isExecutingSlashRef.current = false;
    }, 250);

    setSlashMenuOpen(false);
    slashMenuStateRef.current.isOpen = false;

    const currentRange = slashRangeRef.current;
    const docSize = currentEditor.state.doc.content.size;
    const safeFrom = Math.max(0, Math.min(currentRange.from, docSize));
    const safeTo = Math.max(safeFrom, Math.min(currentRange.to, docSize));

    // Eksekusi atomik perintah TipTap (atomic chain)
    const chain = item.id === 'footnote' ? currentEditor.chain() : currentEditor.chain().focus();

    // Hapus teks pemicu '/' atau query pencarian
    if (safeTo > safeFrom) {
      chain.deleteRange({ from: safeFrom, to: safeTo });
    }

    // Jalankan pemformatan node yang eksplisit
    switch (item.id) {
      case 'h1':
        chain.setHeading({ level: 1 }).run();
        break;
      case 'h2':
        chain.setHeading({ level: 2 }).run();
        break;
      case 'h3':
        chain.setHeading({ level: 3 }).run();
        break;
      case 'paragraph':
        chain.setParagraph().run();
        break;
      case 'bullet-list':
        chain.toggleBulletList().run();
        break;
      case 'numbered-list':
        chain.insertContent('1. ').run();
        break;
      case 'footnote':
        chain.run();
        setFootnoteModalState({
          isOpen: true,
          isEdit: false,
          id: `fn-${Date.now()}`,
          text: '',
          insertPos: safeFrom,
        });
        break;
      case 'blockquote':
        chain.toggleBlockquote().run();
        break;
      case 'horizontal-rule':
        chain.setHorizontalRule().run();
        break;
      case 'table':
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      default:
        item.action(currentEditor);
        chain.run();
        break;
    }

    if (item.id !== 'footnote') {
      setTimeout(() => {
        currentEditor.commands.focus();
      }, 20);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        orderedList: false, // Unified numbering sistem menangani angka secara mulus di paragraf
        heading: { levels: [1, 2, 3] },
      }),
      CustomParagraph,
      FootnoteNode,
      PageBreakNode,
      DocTocNode,
      Underline,
      TabIndent,
      HangingIndent,
      EmDash,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'nulis-table',
        },
      }),
      TableRow,
      CustomTableHeader,
      CustomTableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CustomHighlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder: ({ editor }) => {
          const { doc } = editor.state;
          // Placeholder hanya muncul jika seluruh naskah benar-benar kosong:
          // Hanya ada tepat 1 node di dokumen, berupa paragraf biasa, dan belum berisi teks apa pun.
          // Jika ada tabel, subjudul, halaman baru, atau blok apa pun di bawahnya, sembunyikan placeholder!
          if (doc.childCount !== 1) return '';
          const first = doc.firstChild;
          if (!first || first.type.name !== 'paragraph' || first.content.size > 0) return '';
          return placeholder || 'Tulis di sini...';
        },
        emptyEditorClass: 'is-editor-empty',
      }),
      AutoPagination.configure({
        getLayoutMode: () => layoutModeRef.current,
        linesPerPage: 34,
        onEditFootnote: (fn) => {
          if (!readOnly) openEditFootnote(fn);
        },
        onPaginationUpdate: (data) => {
          const serialized = JSON.stringify(data);
          if (serialized !== lastPaginationDataRef.current) {
            lastPaginationDataRef.current = serialized;
            setPaginationData(data);
            paginationDataRef.current = data;
            if (editorRef.current) {
              const from = editorRef.current.state.selection.from;
              let p = 1;
              for (const bp of data.breakPoints) {
                if (from >= bp.offset) {
                  p = bp.toPage;
                } else {
                  break;
                }
              }
              setActivePage(Math.min(p, Math.max(1, data.totalPages)));
            }
          }
        },
      }),
    ],
    content: sanitizeContent(initialContent),
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none',
        spellcheck: 'false',
        lang: 'id',
        autocorrect: 'off',
        autocapitalize: 'off',
      },
      handleKeyDown: (view, event) => {
        // Indentasi Gantung / Daftar Pustaka (Alt+T, Alt+G, Ctrl+T, Ctrl+Shift+T)
        // Catatan: Chrome/Edge pada Windows mengunci native Ctrl+T untuk "Buka Tab Baru",
        // sehingga Alt+T atau Alt+G adalah pintasan cepat yang 100% aman dan langsung berfungsi.
        if (
          (event.altKey && (event.key.toLowerCase() === 't' || event.key.toLowerCase() === 'g')) ||
          ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't')
        ) {
          event.preventDefault();
          return toggleHangingIndentHelper(view);
        }

        // Tambah Halaman Baru (Ctrl+Enter / Cmd+Enter) ala Microsoft Word
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          return insertPageBreakHelper(view);
        }

        // Mode Guru: Guru tidak memiliki akses edit ke naskah siswa.
        // Guru hanya boleh menyeleksi kata/kalimat untuk memberi catatan atau menavigasi kursor.
        if (isTeacher) {
          const allowedKeys = [
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
            'Home', 'End', 'PageUp', 'PageDown', 'Escape'
          ];
          // Izinkan salin teks (Ctrl/Cmd + C)
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
            return false;
          }
          // Izinkan navigasi kursor
          if (allowedKeys.includes(event.key)) {
            return false;
          }
          // Blokir semua input pengetikan (huruf, angka, simbol, Enter, Backspace, Delete, Cut, Paste)
          event.preventDefault();
          return true;
        }

        // Pintasan Keyboard Ctrl+F / Cmd+F untuk Cari & Ganti
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault();
          event.stopPropagation();
          handleToggleFindReplace();
          return true;
        }

        // Tutup Cari & Ganti saat tombol Escape ditekan
        if (showFindReplaceRef.current && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          handleCloseFindReplace();
          return true;
        }

        // Anti Copy-Paste untuk Siswa
        if (blockCopyPaste && (event.ctrlKey || event.metaKey)) {
          const key = event.key.toLowerCase();
          if (key === 'c' || key === 'v') {
            event.preventDefault();
            alert('Fitur Salin/Tempel dinonaktifkan untuk menjaga orisinalitas tulisan.');
            return true;
          }
        }

        // Navigasi Keyboard Menu Slash (/) via State Ref agar bebas stale closure
        const state = slashMenuStateRef.current;
        if (state.isOpen && state.items.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIdx = (state.selectedIndex + 1) % state.items.length;
            setSlashSelectedIndex(nextIdx);
            slashMenuStateRef.current.selectedIndex = nextIdx;
            // Scroll otomatis ke item yang dipilih
            slashItemRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            const prevIdx = (state.selectedIndex - 1 + state.items.length) % state.items.length;
            setSlashSelectedIndex(prevIdx);
            slashMenuStateRef.current.selectedIndex = prevIdx;
            // Scroll otomatis ke item yang dipilih
            slashItemRefs.current[prevIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            const selectedItem = state.items[state.selectedIndex];
            if (selectedItem) {
              executeSlashOption(selectedItem);
            }
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setSlashMenuOpen(false);
            slashMenuStateRef.current.isOpen = false;
            return true;
          }
        }

        // Unified Auto Numbering (1., 2., 1.1, 1.2, 2.1, 1.1.1 dst) & Preservasi Indentasi
        if (event.key === 'Enter' && !event.shiftKey) {
          const pstate = view.state;
          const { selection } = pstate;
          const { $from, empty } = selection;
          if (empty && $from.parent.isTextblock) {
            let insideList = false;
            for (let d = $from.depth; d > 0; d--) {
              const nodeName = $from.node(d).type.name;
              if (nodeName === 'orderedList' || nodeName === 'bulletList') {
                insideList = true;
                break;
              }
            }

            if (!insideList) {
              const lineText = $from.parent.textContent;
              const match = lineText.match(/^(\d+(?:\.\d+)*)\.?\s*(.*)$/);
              if (match) {
                event.preventDefault();
                const prefixNum = match[1];
                const restText = match[2];

                // Jika baris hanya berisi nomor kosong (misal baru dibuat "2. " lalu tekan Enter lagi)
                // maka hapus nomor, biarkan kursor tetap di baris ini dengan indentasi yang sesuai!
                if (restText.trim() === '') {
                  const start = $from.start();
                  const end = $from.end();
                  const tr = pstate.tr.delete(start, end);
                  view.dispatch(tr);
                  return true;
                }

                // Hitung nomor berikutnya:
                // 1. -> 2.
                // 2. -> 3.
                // 1.1 -> 1.2
                // 1.1.1 -> 1.1.2
                const parts = prefixNum.split('.').map(Number);
                parts[parts.length - 1] += 1;
                const nextPrefix = parts.join('.') + (parts.length === 1 ? '. ' : ' ');
                const nextLevel = Math.min(4, parts.length - 1);

                if (editorRef.current) {
                  editorRef.current
                    .chain()
                    .splitBlock()
                    .updateAttributes('paragraph', { indent: nextLevel })
                    .insertContent(nextPrefix)
                    .run();
                }
                return true;
              }

              // Paragraf biasa: Tekan Enter otomatis mewariskan indentasi yang sama ke paragraf baru
              const currentIndent = $from.parent.attrs.indent || 0;
              if (currentIndent > 0) {
                event.preventDefault();
                if (editorRef.current) {
                  editorRef.current
                    .chain()
                    .splitBlock()
                    .updateAttributes('paragraph', { indent: currentIndent })
                    .run();
                }
                return true;
              }
            }
          }
        }

        // Hapus pemisah halaman / footnote seketika saat Backspace
        if (event.key === 'Backspace') {
          const pstate = view.state;
          const { selection } = pstate;

          if (selection instanceof NodeSelection && selection.node.type.name === 'pageBreak') {
            event.preventDefault();
            const tr = pstate.tr.delete(selection.from, selection.to);
            view.dispatch(tr.scrollIntoView());
            return true;
          }

          const { $from, empty } = selection;
          if (empty) {
            // Hapus Footnote seketika jika kursor tepat setelah footnote
            if ($from.nodeBefore && $from.nodeBefore.type.name === 'footnote') {
              event.preventDefault();
              const tr = pstate.tr.delete($from.pos - $from.nodeBefore.nodeSize, $from.pos);
              view.dispatch(tr.scrollIntoView());
              return true;
            }

            // Hapus Halaman Baru (PageBreak) jika kursor berada di awal blok setelah pageBreak
            if ($from.parent.isTextblock && $from.parentOffset === 0) {
              const posBeforeBlock = $from.before($from.depth);
              const $before = pstate.doc.resolve(posBeforeBlock);
              const nodeBefore = $before.nodeBefore;
              if (nodeBefore && nodeBefore.type.name === 'pageBreak') {
                event.preventDefault();
                const { tr, schema } = pstate;
                const pageBreakPos = posBeforeBlock - nodeBefore.nodeSize;
                if ($from.parent.content.size === 0) {
                  const currentBlockEnd = $from.after($from.depth);
                  tr.delete(pageBreakPos, currentBlockEnd);
                  if (tr.doc.childCount === 0) {
                    tr.insert(0, schema.nodes.paragraph.create());
                    tr.setSelection(TextSelection.create(tr.doc, 1));
                  } else {
                    const targetPos = Math.max(0, Math.min(pageBreakPos, tr.doc.content.size));
                    tr.setSelection(Selection.near(tr.doc.resolve(targetPos), -1));
                  }
                } else {
                  tr.delete(pageBreakPos, posBeforeBlock);
                }
                view.dispatch(tr.scrollIntoView());
                return true;
              }
            }
          }

          if (empty && $from.parent.isTextblock) {
            let insideList = false;
            for (let d = $from.depth; d > 0; d--) {
              const nodeName = $from.node(d).type.name;
              if (nodeName === 'orderedList' || nodeName === 'bulletList') {
                insideList = true;
                break;
              }
            }

            if (!insideList) {
              const lineText = $from.parent.textContent;
              const match = lineText.match(/^(\d+(?:\.\d+)*)\.?\s*(.*)$/);
              if (match) {
                const fullPrefixMatch = lineText.match(/^(\d+(?:\.\d+)*\.?\s*)/);
                const prefixLen = fullPrefixMatch ? fullPrefixMatch[0].length : 0;
                
                // Jika kursor berada tepat di ujung prefix (misal kursor di "2. |")
                // Hapus prefix dengan tenang di tempat, tanpa terpental atau melompat ke baris atas!
                if ($from.parentOffset === prefixLen && prefixLen > 0) {
                  event.preventDefault();
                  const start = $from.start();
                  const tr = pstate.tr.delete(start, start + prefixLen);
                  view.dispatch(tr);
                  return true;
                }
              }

              // Jika kursor berada di paling awal paragraf (offset 0) dan memiliki indentasi > 0:
              // Langsung outdent ke tingkat indentasi di atasnya (misal level 2 -> level 1 -> level 0)!
              if ($from.parentOffset === 0) {
                const currentIndent = $from.parent.attrs.indent || 0;
                if (currentIndent > 0) {
                  event.preventDefault();
                  if (editorRef.current) {
                    editorRef.current.commands.updateAttributes('paragraph', {
                      indent: currentIndent - 1,
                    });
                  }
                  return true;
                }
              }
            }
          }
        }

        // Hapus pemisah halaman / footnote seketika saat Delete (forward delete)
        if (event.key === 'Delete') {
          const pstate = view.state;
          const { selection } = pstate;

          if (selection instanceof NodeSelection && selection.node.type.name === 'pageBreak') {
            event.preventDefault();
            const tr = pstate.tr.delete(selection.from, selection.to);
            view.dispatch(tr.scrollIntoView());
            return true;
          }

          const { $from, empty } = selection;
          if (empty) {
            // Hapus Footnote seketika jika kursor tepat sebelum footnote
            if ($from.nodeAfter && $from.nodeAfter.type.name === 'footnote') {
              event.preventDefault();
              const tr = pstate.tr.delete($from.pos, $from.pos + $from.nodeAfter.nodeSize);
              view.dispatch(tr.scrollIntoView());
              return true;
            }

            // Hapus PageBreak jika kursor di akhir blok sebelum pageBreak
            if ($from.parent.isTextblock && $from.parentOffset === $from.parent.content.size) {
              const posAfterBlock = $from.after($from.depth);
              const $after = pstate.doc.resolve(posAfterBlock);
              const nodeAfter = $after.nodeAfter;
              if (nodeAfter && nodeAfter.type.name === 'pageBreak') {
                event.preventDefault();
                const { tr } = pstate;
                const pageBreakEnd = posAfterBlock + nodeAfter.nodeSize;
                const $afterPageBreak = pstate.doc.resolve(pageBreakEnd);
                const nextBlock = $afterPageBreak.nodeAfter;
                if (nextBlock && nextBlock.isTextblock && nextBlock.content.size === 0) {
                  tr.delete(posAfterBlock, pageBreakEnd + nextBlock.nodeSize);
                } else {
                  tr.delete(posAfterBlock, pageBreakEnd);
                }
                view.dispatch(tr.scrollIntoView());
                return true;
              }
            }
          }
        }

        // Saat mengetik spasi setelah mengetik nomor (misal "1. ", "2. ", "1.1 "), otomatis set indentasi hierarki yang sesuai
        if (event.key === ' ') {
          const pstate = view.state;
          const { selection } = pstate;
          const { $from, empty } = selection;
          if (empty && $from.parent.isTextblock) {
            const lineText = $from.parent.textContent;
            const match = lineText.match(/^(\d+(?:\.\d+)*)\.?$/);
            if (match && $from.parentOffset === lineText.length) {
              const dots = match[1].split('.').length - 1;
              const targetLevel = Math.min(4, dots);
              if (editorRef.current) {
                editorRef.current.commands.updateAttributes('paragraph', {
                  indent: targetLevel,
                });
              }
            }
          }
        }

        return false;
      },
      handleDOMEvents: {
        beforeinput: (_view, event) => {
          if (isTeacher) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        paste: (_view, event) => {
          if (isTeacher) {
            event.preventDefault();
            return true;
          }
          if (blockCopyPaste) return true;
          return false;
        },
        contextmenu: (_view, event) => {
          if (blockCopyPaste) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        drop: (_view, event) => {
          if (isTeacher) {
            event.preventDefault();
            return true;
          }
          if (blockCopyPaste) return true;
          return false;
        },
        mouseover: (_view, event) => {
          const target = event.target as HTMLElement;
          const mark = target.closest('mark');
          if (mark && onHoverFeedback) {
            const pesan = mark.getAttribute('data-pesan') || '';
            const kata = mark.textContent || '';
            const rect = mark.getBoundingClientRect();
            onHoverFeedback({
              pesan,
              kata,
              rect: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height,
              },
            });
          } else if (onHoverFeedback) {
            onHoverFeedback(null);
          }
          return false;
        },
        click: (_view, event) => {
          const target = event.target as HTMLElement;
          const footnoteEl = target.closest('.nulis-footnote-ref, [data-footnote-id]');
          if (footnoteEl) {
            const id = footnoteEl.getAttribute('data-footnote-id') || '';
            const text = footnoteEl.getAttribute('data-footnote-text') || '';
            if (!readOnly) {
              setFootnoteModalState({
                isOpen: true,
                isEdit: true,
                id,
                text,
              });
            }
            return true;
          }

          const mark = target.closest('mark');
          if (mark) {
            const pesan = mark.getAttribute('data-pesan') || '';
            const text = mark.textContent || '';
            const rect = mark.getBoundingClientRect();
            if (isTeacher) {
              setActiveMarkFeedback({
                pesan,
                text,
                markElement: mark,
                rect,
              });
              setIsEditingFeedback(false);
              setEditingFeedbackText(pesan);
            } else if (onHoverFeedback) {
              onHoverFeedback({
                pesan,
                kata: text,
                rect: {
                  top: rect.top,
                  bottom: rect.bottom,
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                  height: rect.height,
                },
              });
            }
          } else {
            if (isTeacher) {
              if (!target.closest('.teacher-feedback-popup')) {
                setActiveMarkFeedback(null);
                setIsEditingFeedback(false);
              }
            }
          }
          return false;
        },
        mouseup: () => {
          if (isTeacher && editor) {
            const { from, to } = editor.state.selection;
            const text = editor.state.doc.textBetween(from, to, ' ').trim();
            if (text.length > 0 && from !== to) {
              setCachedSelection({ from, to });
              setSelectedText(text);
              setSelectedTeacherTags([]);
              setTeacherSlashOpen(false);
              setTeacherSlashQuery('');
              setTeacherSlashSelectedIndex(0);
              setShowTeacherCommentModal(true);
            }
          }
          return false;
        }
      },
    },
    onCreate: ({ editor }) => {
      updateTocHeadings(editor);
      const found = checkForDocToc(editor);
      setHasDocToc(found);
      if (found && layoutModeRef.current !== 'kertas') {
        handleLayoutChange('kertas');
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const from = editor.state.selection.from;
      let p = 1;
      const bps = paginationDataRef.current.breakPoints || [];
      for (const bp of bps) {
        if (from >= bp.offset) {
          p = bp.toPage;
        } else {
          break;
        }
      }
      setActivePage(Math.min(p, Math.max(1, paginationDataRef.current.totalPages)));
      updateActiveTablePos();
    },
    onUpdate: ({ editor }) => {
      let html = editor.getHTML();
      if (html.includes('--')) {
        html = html.replace(/--/g, '—');
      }

      lastEmittedHtmlRef.current = html;
      onUpdateRef.current?.(html);
      updateFootnotesList();
      updateTocHeadings(editor);
      const found = checkForDocToc(editor);
      setHasDocToc(found);
      if (found && layoutModeRef.current !== 'kertas') {
        handleLayoutChange('kertas');
      }
      updateActiveTablePos();

      // Fleksibel seperti sebelumnya: Kursor bebas bergerak di seluruh layar tanpa terkunci di tengah.
      // Hanya scroll jika kursor melewati batas bawah layar, menggunakan behavior: 'auto' (0ms) bebas getaran.
      if (!readOnly && editor.view) {
        try {
          const { from } = editor.state.selection;
          const coords = editor.view.coordsAtPos(from);
          if (coords && coords.bottom > 0) {
            const bottomLimit = window.innerHeight - 80;
            if (coords.bottom > bottomLimit) {
              const delta = coords.bottom - bottomLimit;
              window.scrollBy({ top: delta, behavior: 'auto' });
            }
          }
        } catch {}
      }

      // Hitung statistik kata & karakter akurat (termasuk saat Enter / baris baru)
      const stats = computeDocumentStats(editor.state.doc);
      setEditorStats((prev) => (prev.words === stats.words && prev.characters === stats.characters ? prev : stats));

      // Update posisi halaman aktif
      const from = editor.state.selection.from;
      let p = 1;
      const bps = paginationDataRef.current.breakPoints || [];
      for (const bp of bps) {
        if (from >= bp.offset) {
          p = bp.toPage;
        } else {
          break;
        }
      }
      setActivePage(Math.min(p, Math.max(1, paginationDataRef.current.totalPages)));

      // Deteksi Slash Command (/) saat mengetik
      if (!readOnly && !isTeacher) {
        const { from } = editor.state.selection;
        const resolved = editor.state.doc.resolve(from);
        const textBefore = resolved.parent.textBetween(0, resolved.parentOffset, undefined, '\ufffc');
        const slashMatch = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9]*)$/);
        if (slashMatch) {
          const query = slashMatch[1];
          const matchStartInParent = resolved.parentOffset - query.length - 1;
          const startPos = resolved.start() + matchStartInParent;
          try {
            const coords = editor.view.coordsAtPos(from);
            const menuHeight = 280;
            const menuWidth = 260;
            const spaceBelow = window.innerHeight - coords.bottom;
            const spaceAbove = coords.top;

            // Jika ruang bawah sempit (< 280px) dan di atas cukup -> muncul di atas kursor
            let top: number;
            if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
              top = Math.max(12, coords.top - menuHeight - 8);
            } else {
              // Muncul di bawah kursor, tapi dicegah tenggelam keluar viewport
              top = Math.max(12, Math.min(window.innerHeight - menuHeight - 16, coords.bottom + 8));
            }

            const left = Math.max(16, Math.min(coords.left, window.innerWidth - menuWidth - 16));

            setSlashMenuCoords({ top, left });
            setSlashQuery(query);
            const range = { from: startPos, to: from };
            setSlashRange(range);
            slashRangeRef.current = range;
            setSlashSelectedIndex(0);
            setSlashMenuOpen(true);
            slashMenuStateRef.current.isOpen = true;
          } catch {
            setSlashMenuOpen(false);
            slashMenuStateRef.current.isOpen = false;
          }
        } else {
          setSlashMenuOpen(false);
          slashMenuStateRef.current.isOpen = false;
        }
      }
    },
  });

  editorRef.current = editor;

  // Sinkronisasi nomor halaman heading saat auto-pagination selesai menghitung
  useEffect(() => {
    if (editorRef.current) {
      updateTocHeadings(editorRef.current);
    }
  }, [paginationData]);

  // Melompat langsung ke judul/subbab saat diklik di daftar isi
  const jumpToHeading = (pos: number) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    try {
      currentEditor.chain().focus().setTextSelection(pos + 1).run();
      const dom = currentEditor.view.nodeDOM(pos);
      if (dom && dom instanceof HTMLElement) {
        dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const coords = currentEditor.view.coordsAtPos(pos);
        if (coords) {
          window.scrollTo({
            top: window.scrollY + coords.top - 120,
            behavior: 'smooth',
          });
        }
      }
    } catch (err) {
      console.error('Gagal melompat ke bab:', err);
    }
  };

  // Update posisi toolbar tabel mengambang agar selalu melekat di atas tabel aktif
  const updateActiveTablePos = () => {
    const curEditor = editorRef.current;
    if (!curEditor || !curEditor.isActive('table') || readOnly) {
      setActiveTableCoords(null);
      setShowTableColorMenu(false);
      return;
    }
    try {
      const { from } = curEditor.state.selection;
      const dom = curEditor.view.domAtPos(from);
      const cellEl = (dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement)?.closest('td, th');
      const tableEl = cellEl?.closest('table') || curEditor.view.dom.querySelector('.tiptap table:focus-within, .tiptap table');
      if (tableEl) {
        const rect = tableEl.getBoundingClientRect();
        // Selalu tampil mengambang di atas tabel, dan menempel di batas atas (sticky 68px) saat pengguna scroll melewati bagian atas tabel
        const top = Math.max(68, rect.top - 46);
        const left = Math.max(16, Math.min(window.innerWidth - 560, rect.left));
        setActiveTableCoords({ top, left });
      } else {
        setActiveTableCoords({ top: 68, left: 16 });
      }
    } catch {
      setActiveTableCoords(null);
      setShowTableColorMenu(false);
    }
  };

  useEffect(() => {
    updateActiveTablePos();
    const handleScrollResize = () => updateActiveTablePos();
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, []);

  // Pintasan Keyboard Global untuk Indentasi Gantung / Daftar Pustaka (Alt+T, Alt+G, Ctrl+T) & Cari Ganti (Ctrl+F, Esc)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Pintasan Global Ctrl+F / Cmd+F untuk Cari & Ganti
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        handleToggleFindReplace();
        return;
      }

      // Pintasan Global Escape untuk menutup Cari & Ganti
      if (e.key === 'Escape' && showFindReplaceRef.current) {
        e.preventDefault();
        e.stopPropagation();
        handleCloseFindReplace();
        return;
      }

      if (
        (e.altKey && (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'g')) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't')
      ) {
        const curEditor = editorRef.current;
        if (curEditor && curEditor.isFocused) {
          e.preventDefault();
          e.stopPropagation();
          toggleHangingIndentHelper(curEditor.view);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalShortcuts, { capture: true });
    };
  }, []);

  // Deteksi hover pada garis persilangan tabel (tampilkan tombol '+' di sisi luar tabel ala Word/Docs)
  const handleEditorMouseMove = (e: React.MouseEvent) => {
    if (readOnly || isTeacher) return;
    const curEditor = editorRef.current;
    if (!curEditor) return;

    const target = e.target as HTMLElement;
    if (target.closest('.nulis-table-add-btn')) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Jika mouse sedang mendekati tombol '+' yang sudah aktif (radius 50px), pertahankan tombol!
    if (hoverAddBtn) {
      const dist = Math.hypot(mouseX - hoverAddBtn.x, mouseY - hoverAddBtn.y);
      if (dist < 50) return;
    }

    const tables = Array.from(curEditor.view.dom.querySelectorAll('table')) as HTMLTableElement[];
    let nearbyTable: HTMLTableElement | null = null;
    let nearbyRect: DOMRect | null = null;

    for (const tbl of tables) {
      const rect = tbl.getBoundingClientRect();
      if (
        mouseX >= rect.left - 45 &&
        mouseX <= rect.right + 45 &&
        mouseY >= rect.top - 45 &&
        mouseY <= rect.bottom + 45
      ) {
        nearbyTable = tbl;
        nearbyRect = rect;
        break;
      }
    }

    if (!nearbyTable || !nearbyRect) {
      if (hoverAddBtn) setHoverAddBtn(null);
      return;
    }

    const tRect = nearbyRect;
    const table = nearbyTable;

    // Jika mouse berada di DALAM sel tabel, jangan tampilkan tombol '+' (agar tidak mengganggu saat mengetik teks)
    const isInsideTable =
      mouseX > tRect.left + 8 &&
      mouseX < tRect.right - 8 &&
      mouseY > tRect.top + 8 &&
      mouseY < tRect.bottom - 8;

    if (isInsideTable) {
      if (hoverAddBtn) setHoverAddBtn(null);
      return;
    }

    const tableStart = curEditor.view.posAtDOM(table, 0);

    // 1. Cek Sisi Luar Atas Tabel (Tambah Kolom)
    const isTopGutter =
      mouseY >= tRect.top - 40 &&
      mouseY <= tRect.top + 8 &&
      mouseX >= tRect.left - 12 &&
      mouseX <= tRect.right + 12;

    if (isTopGutter) {
      const firstRow = table.querySelector('tr:not(.nulis-table-page-break-row)');
      if (firstRow) {
        const cells = Array.from(firstRow.children) as HTMLElement[];
        let closestCol: { x: number; index: number } | null = null;
        let minDiff = Infinity;

        cells.forEach((cell, idx) => {
          const cRect = cell.getBoundingClientRect();

          if (idx === 0) {
            const diff = Math.abs(mouseX - cRect.left);
            if (diff < minDiff && diff < 32) {
              minDiff = diff;
              closestCol = { x: cRect.left, index: 0 };
            }
          }

          const diff = Math.abs(mouseX - cRect.right);
          if (diff < minDiff && diff < 32) {
            minDiff = diff;
            closestCol = { x: cRect.right, index: idx + 1 };
          }
        });

        if (closestCol) {
          const col = closestCol as { x: number; index: number };
          setHoverAddBtn({
            type: 'col',
            x: col.x,
            y: tRect.top - 14,
            tableStart,
            index: col.index,
            lineStart: { x: col.x, y: tRect.top },
            lineEnd: { x: col.x, y: tRect.bottom },
          });
          return;
        }
      }
    }

    // 2. Cek Sisi Luar Kiri Tabel (Tambah Baris)
    const isLeftGutter =
      mouseX >= tRect.left - 40 &&
      mouseX <= tRect.left + 8 &&
      mouseY >= tRect.top - 12 &&
      mouseY <= tRect.bottom + 12;

    if (isLeftGutter) {
      const rows = Array.from(table.querySelectorAll('tr:not(.nulis-table-page-break-row)')) as HTMLElement[];
      let closestRow: { y: number; index: number } | null = null;
      let minDiff = Infinity;

      rows.forEach((row, idx) => {
        const rRect = row.getBoundingClientRect();

        if (idx === 0) {
          const diff = Math.abs(mouseY - rRect.top);
          if (diff < minDiff && diff < 28) {
            minDiff = diff;
            closestRow = { y: rRect.top, index: 0 };
          }
        }

        const diff = Math.abs(mouseY - rRect.bottom);
        if (diff < minDiff && diff < 28) {
          minDiff = diff;
          closestRow = { y: rRect.bottom, index: idx + 1 };
        }
      });

      if (closestRow) {
        const row = closestRow as { y: number; index: number };
        setHoverAddBtn({
          type: 'row',
          x: tRect.left - 14,
          y: row.y,
          tableStart,
          index: row.index,
          lineStart: { x: tRect.left, y: row.y },
          lineEnd: { x: tRect.right, y: row.y },
        });
        return;
      }
    }

    if (hoverAddBtn) setHoverAddBtn(null);
  };

  // Jaga posisi floating menu slash saat di-scroll atau di-resize
  useEffect(() => {
    if (!slashMenuOpen || !editorRef.current) return;
    const handleScrollOrResize = () => {
      try {
        const { from } = editorRef.current.state.selection;
        const coords = editorRef.current.view.coordsAtPos(from);
        const menuHeight = 280;
        const menuWidth = 260;
        const spaceBelow = window.innerHeight - coords.bottom;
        const spaceAbove = coords.top;

        let top: number;
        if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
          top = Math.max(12, coords.top - menuHeight - 8);
        } else {
          top = Math.max(12, Math.min(window.innerHeight - menuHeight - 16, coords.bottom + 8));
        }

        const left = Math.max(16, Math.min(coords.left, window.innerWidth - menuWidth - 16));
        setSlashMenuCoords({ top, left });
      } catch {}
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [slashMenuOpen]);

  // Auto-scroll item saat index berubah
  useEffect(() => {
    if (slashMenuOpen && slashItemRefs.current[slashSelectedIndex]) {
      slashItemRefs.current[slashSelectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [slashSelectedIndex, slashMenuOpen]);

  // Tutup floating slash menu saat mengklik di luar area menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        slashMenuOpen &&
        slashMenuContainerRef.current &&
        !slashMenuContainerRef.current.contains(e.target as Node)
      ) {
        setSlashMenuOpen(false);
        slashMenuStateRef.current.isOpen = false;
      }
    };
    if (slashMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [slashMenuOpen]);

  // Guard untuk mencegah bug teks muncul kembali saat pengguna sedang aktif mengetik/menghapus
  // atau saat berpindah layout / kehilangan fokus sementara
  useEffect(() => {
    if (!editor) return;
    if (initialContent === lastEmittedHtmlRef.current) return;
    if (editor.isFocused) return;
    const clean = sanitizeContent(initialContent);

    // Safety guard: Jangan pernah menimpa editor yang sudah terisi teks dengan konten kosong dari props!
    const currentText = editor.state.doc.textContent.trim();
    const isIncomingBlank = !clean || clean === '<p></p>' || clean === '<p><br></p>';
    if (currentText.length > 10 && isIncomingBlank) {
      console.warn('[NulisEditor Guard] Menolak setContent kosong karena editor sudah memiliki teks.');
      return;
    }

    if (clean !== editor.getHTML()) {
      lastEmittedHtmlRef.current = clean;
      editor.commands.setContent(clean, { emitUpdate: false });
    }
  }, [initialContent, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  // Sinkronisasi daftar catatan kaki & statistik kata saat konten dimuat
  useEffect(() => {
    if (editor) {
      const timer = setTimeout(() => {
        updateFootnotesList();
        const stats = computeDocumentStats(editor.state.doc);
        setEditorStats(stats);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editor, initialContent]);

  // Efek pencarian kata saat findQuery berubah
  useEffect(() => {
    hasNavigatedRef.current = false;
    if (!editor || !findQuery.trim()) {
      setFindMatches([]);
      setCurrentMatchIndex(0);
      return;
    }
    const q = findQuery.toLowerCase();
    const matches: Array<{ from: number; to: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const text = node.text.toLowerCase();
        let idx = text.indexOf(q);
        while (idx !== -1) {
          matches.push({
            from: pos + idx,
            to: pos + idx + q.length,
          });
          idx = text.indexOf(q, idx + 1);
        }
      }
    });
    setFindMatches(matches);

    if (matches.length > 0) {
      const currentPos = editor.state.selection.from;
      // Best Practice UX: Cari kecocokan terdekat yang berada di posisi kursor/viewport saat ini
      // agar tidak melompat tiba-tiba ke halaman 1 saat pengguna sedang berada di halaman 3 dsb.
      let targetIdx = matches.findIndex((m) => m.from >= currentPos);
      if (targetIdx === -1) {
        targetIdx = 0;
      }
      setCurrentMatchIndex(targetIdx);
      // PENTING: JANGAN panggil .scrollIntoView() secara pasif di sini!
      // Mengetik kata pencarian atau membuka widget tidak boleh memaksa pergeseran scroll viewport.
      // Scroll hanya terjadi saat pengguna menekan Enter atau mengklik tombol Next/Prev.
    } else {
      setCurrentMatchIndex(0);
    }
  }, [findQuery, editor]);

  const handleNextMatch = () => {
    if (!editor || findMatches.length === 0) return;
    let nextIdx = currentMatchIndex;
    if (hasNavigatedRef.current) {
      nextIdx = (currentMatchIndex + 1) % findMatches.length;
    } else {
      hasNavigatedRef.current = true;
    }
    setCurrentMatchIndex(nextIdx);
    const target = findMatches[nextIdx];
    if (target) {
      editor.chain().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run();
    }
  };

  const handlePrevMatch = () => {
    if (!editor || findMatches.length === 0) return;
    let prevIdx = currentMatchIndex;
    if (hasNavigatedRef.current) {
      prevIdx = (currentMatchIndex - 1 + findMatches.length) % findMatches.length;
    } else {
      hasNavigatedRef.current = true;
    }
    setCurrentMatchIndex(prevIdx);
    const target = findMatches[prevIdx];
    if (target) {
      editor.chain().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run();
    }
  };

  const handleReplaceCurrent = () => {
    if (!editor || findMatches.length === 0) return;
    const target = findMatches[currentMatchIndex];
    if (target) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: target.from, to: target.to })
        .insertContentAt(target.from, replaceQuery)
        .run();
    }
  };

  const handleReplaceAll = () => {
    if (!editor || !findQuery.trim()) return;
    const q = findQuery.toLowerCase();
    const matches: Array<{ from: number; to: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const text = node.text.toLowerCase();
        let idx = text.indexOf(q);
        while (idx !== -1) {
          matches.push({
            from: pos + idx,
            to: pos + idx + q.length,
          });
          idx = text.indexOf(q, idx + 1);
        }
      }
    });

    if (matches.length === 0) return;

    const tr = editor.state.tr;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      tr.replaceWith(m.from, m.to, editor.schema.text(replaceQuery));
    }
    editor.view.dispatch(tr);
    setFindMatches([]);
    setCurrentMatchIndex(0);
  };

  if (!editor) return null;

  const handleTeacherCommentChange = (text: string) => {
    setCommentText(text);
    const cursor = commentTextareaRef.current?.selectionStart ?? text.length;
    const beforeCursor = text.slice(0, cursor);
    const slashMatch = beforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_]*)$/);
    if (slashMatch) {
      setTeacherSlashQuery(slashMatch[1]);
      setTeacherSlashOpen(true);
      setTeacherSlashSelectedIndex(0);
    } else {
      setTeacherSlashOpen(false);
    }
  };

  const handleInsertTeacherTag = (option: TeacherFeedbackOption) => {
    if (!selectedTeacherTags.includes(option.id)) {
      setSelectedTeacherTags((prev) => [...prev, option.id]);
    }
    const cursor = commentTextareaRef.current?.selectionStart ?? commentText.length;
    const beforeCursor = commentText.slice(0, cursor);
    const afterCursor = commentText.slice(cursor);
    const slashMatch = beforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_]*)$/);
    let cleanBefore = beforeCursor;
    if (slashMatch) {
      cleanBefore = beforeCursor.slice(0, beforeCursor.length - slashMatch[1].length - 1);
    }
    setCommentText((cleanBefore + afterCursor).trim());
    setTeacherSlashOpen(false);
    setTimeout(() => {
      commentTextareaRef.current?.focus();
    }, 20);
  };

  const handleInsertTeacherTemplate = (option: TeacherFeedbackOption) => {
    if (!selectedTeacherTags.includes(option.id)) {
      setSelectedTeacherTags((prev) => [...prev, option.id]);
    }
    const cursor = commentTextareaRef.current?.selectionStart ?? commentText.length;
    const beforeCursor = commentText.slice(0, cursor);
    const afterCursor = commentText.slice(cursor);
    const slashMatch = beforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_]*)$/);
    let cleanBefore = beforeCursor;
    if (slashMatch) {
      cleanBefore = beforeCursor.slice(0, beforeCursor.length - slashMatch[1].length - 1);
    }
    const inserted = cleanBefore.trim() ? `${cleanBefore.trim()} ${option.template}` : option.template;
    setCommentText((inserted + ' ' + afterCursor).trim());
    setTeacherSlashOpen(false);
    setTimeout(() => {
      commentTextareaRef.current?.focus();
    }, 20);
  };

  const applyTeacherComment = (overrideText?: string) => {
    const textToApply = (overrideText !== undefined ? overrideText : commentText).trim();
    if (!textToApply && selectedTeacherTags.length === 0) return;
    if (!editor) return;

    // Kumpulkan badge tag terpilih
    const tagOptions = selectedTeacherTags
      .map((id) => TEACHER_FEEDBACK_OPTIONS.find((o) => o.id === id))
      .filter((opt): opt is TeacherFeedbackOption => Boolean(opt));

    let finalMessage = textToApply;
    tagOptions.forEach((opt) => {
      if (!finalMessage.includes(opt.tag)) {
        finalMessage = `${opt.tag} ${finalMessage}`.trim();
      }
    });

    const markAttrs: Record<string, string> = {
      'data-pesan': finalMessage || 'Perlu perbaikan',
    };
    if (selectedTeacherTags.length > 0) {
      markAttrs['data-tag'] = selectedTeacherTags.join(',');
    }

    const targetPos = cachedSelection ? cachedSelection.to : editor.state.selection.to;
    if (cachedSelection) {
      editor
        .chain()
        .focus()
        .setTextSelection(cachedSelection)
        .setMark('highlight', markAttrs)
        .setTextSelection(targetPos)
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setMark('highlight', markAttrs)
        .setTextSelection(targetPos)
        .run();
    }
    window.getSelection()?.removeAllRanges();
    setShowTeacherCommentModal(false);
    setCommentText('');
    setSelectedText('');
    setCachedSelection(null);
    setSelectedTeacherTags([]);
    setTeacherSlashOpen(false);
  };

  const removeTeacherHighlight = () => {
    if (!editor) return;
    const targetPos = cachedSelection ? cachedSelection.to : editor.state.selection.to;
    if (cachedSelection) {
      editor
        .chain()
        .focus()
        .setTextSelection(cachedSelection)
        .unsetMark('highlight')
        .setTextSelection(targetPos)
        .run();
    } else {
      editor
        .chain()
        .focus()
        .unsetMark('highlight')
        .setTextSelection(targetPos)
        .run();
    }
    window.getSelection()?.removeAllRanges();
    setShowTeacherCommentModal(false);
    setCommentText('');
    setSelectedText('');
    setCachedSelection(null);
    setSelectedTeacherTags([]);
    setTeacherSlashOpen(false);
  };

  const handleCloseTeacherModal = () => {
    if (editor && cachedSelection) {
      editor.chain().focus().setTextSelection(cachedSelection.to).run();
    }
    window.getSelection()?.removeAllRanges();
    setShowTeacherCommentModal(false);
    setCommentText('');
    setSelectedText('');
    setCachedSelection(null);
    setSelectedTeacherTags([]);
    setTeacherSlashOpen(false);
  };

  // Simpan hasil edit catatan highlight guru
  const saveEditedFeedback = () => {
    if (!activeMarkFeedback?.markElement || !editor) return;
    const newPesan = editingFeedbackText.trim();
    activeMarkFeedback.markElement.setAttribute('data-pesan', newPesan || 'Perlu perbaikan');
    const updatedHtml = editor.view.dom.innerHTML;
    editor.commands.setContent(updatedHtml, { emitUpdate: false });
    onUpdateRef.current?.(editor.getHTML());
    setActiveMarkFeedback((prev) => (prev ? { ...prev, pesan: newPesan } : null));
    setIsEditingFeedback(false);
  };

  // Hapus highlight tertentu (sesuai flow AppScript hapusFeedback)
  const removeActiveMark = () => {
    if (!activeMarkFeedback?.markElement || !editor) return;
    const markEl = activeMarkFeedback.markElement;
    const parent = markEl.parentNode;
    if (parent) {
      while (markEl.firstChild) {
        parent.insertBefore(markEl.firstChild, markEl);
      }
      parent.removeChild(markEl);
      const updatedHtml = editor.view.dom.innerHTML;
      editor.commands.setContent(updatedHtml, { emitUpdate: false });
      onUpdateRef.current?.(editor.getHTML());
    }
    setActiveMarkFeedback(null);
    setIsEditingFeedback(false);
  };

  // Update posisi popup saat di-scroll atau resize layar
  useEffect(() => {
    if (!activeMarkFeedback?.markElement) return;
    const updateRect = () => {
      if (activeMarkFeedback.markElement && document.body.contains(activeMarkFeedback.markElement)) {
        const nextRect = activeMarkFeedback.markElement.getBoundingClientRect();
        setActiveMarkFeedback((prev) => (prev ? { ...prev, rect: nextRect } : null));
      } else {
        setActiveMarkFeedback(null);
        setIsEditingFeedback(false);
      }
    };
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [activeMarkFeedback?.markElement]);

  // Tutup popup jika klik di luar atau tekan tombol Escape
  useEffect(() => {
    if (!activeMarkFeedback) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.teacher-feedback-popup') && !target.closest('mark')) {
        setActiveMarkFeedback(null);
        setIsEditingFeedback(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMarkFeedback(null);
        setIsEditingFeedback(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMarkFeedback]);

  // Hitung posisi floating popup tepat di dekat mark
  const teacherPopupCoords = useMemo(() => {
    if (!activeMarkFeedback?.rect) return null;
    const { rect } = activeMarkFeedback;
    const popupWidth = 320;
    const popupHeight = isEditingFeedback ? 180 : 130;
    const spaceAbove = rect.top;
    const isAbove = spaceAbove >= popupHeight + 12;

    const top = isAbove ? rect.top - 8 : rect.bottom + 8;
    const markCenter = rect.left + rect.width / 2;
    const left = Math.max(16, Math.min(markCenter - popupWidth / 2, window.innerWidth - popupWidth - 16));
    const notchLeft = Math.max(16, Math.min(markCenter - left, popupWidth - 16));

    return {
      top,
      left,
      isAbove,
      notchLeft,
    };
  }, [activeMarkFeedback, isEditingFeedback]);

  return (
    <div className="relative">
      {/* Floating Pop-Up Guru saat mengklik kata ber-highlight (dengan fitur Edit & Hapus) */}
      {isTeacher && activeMarkFeedback && teacherPopupCoords && (
        <div
          style={{
            top: `${teacherPopupCoords.top}px`,
            left: `${teacherPopupCoords.left}px`,
            transform: teacherPopupCoords.isAbove ? 'translateY(-100%)' : 'none',
          }}
          className="fixed z-50 w-80 max-w-[calc(100vw-32px)] editorial-card bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-2 border-amber-400 dark:border-amber-500 p-3.5 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 pointer-events-auto teacher-feedback-popup"
        >
          {/* Segitiga penunjuk arah kata */}
          <div
            style={{ left: `${teacherPopupCoords.notchLeft}px` }}
            className={`absolute w-3 h-3 bg-white dark:bg-stone-900 border-amber-400 dark:border-amber-500 transform rotate-45 -translate-x-1/2 ${
              teacherPopupCoords.isAbove
                ? '-bottom-[7px] border-b-2 border-r-2'
                : '-top-[7px] border-t-2 border-l-2'
            }`}
          />

          <div className="flex items-start justify-between gap-2 mb-2 relative z-10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300 truncate">
              <Sparkles size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">
                Catatan Guru: <span className="font-serif-literary underline">"{activeMarkFeedback.text}"</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveMarkFeedback(null);
                setIsEditingFeedback(false);
              }}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer p-0.5 rounded"
              title="Tutup (Esc)"
            >
              <X size={14} />
            </button>
          </div>

          {!isEditingFeedback ? (
            <div className="relative z-10">
              <p className="text-xs text-stone-700 dark:text-stone-200 bg-amber-50/60 dark:bg-stone-800/60 p-2.5 rounded-xl border border-amber-200/60 dark:border-stone-700/60 mb-2.5 leading-relaxed font-sans">
                {activeMarkFeedback.pesan || 'Tidak ada catatan tertulis'}
              </p>
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingFeedback(true);
                    setEditingFeedbackText(activeMarkFeedback.pesan);
                  }}
                  className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 text-[11px] py-1 px-2.5 flex items-center gap-1 shadow-2xs cursor-pointer rounded-lg border border-stone-200 dark:border-stone-700"
                >
                  <Edit2 size={12} /> Edit Catatan
                </button>
                <button
                  type="button"
                  onClick={removeActiveMark}
                  className="editorial-btn bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 text-[11px] py-1 px-2.5 flex items-center gap-1 shadow-2xs cursor-pointer rounded-lg border border-red-200 dark:border-red-800"
                >
                  <Trash2 size={12} /> Hapus
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col gap-2">
              <textarea
                value={editingFeedbackText}
                onChange={(e) => setEditingFeedbackText(e.target.value)}
                placeholder="Tulis catatan perbaikan untuk siswa..."
                rows={2}
                autoFocus
                className="editorial-input w-full p-2 text-xs bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border border-stone-300 dark:border-stone-700 rounded-xl focus:ring-1 focus:ring-amber-500 font-sans"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingFeedback(false)}
                  className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-600 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-400 text-[11px] py-1 px-2.5 cursor-pointer rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={saveEditedFeedback}
                  className="editorial-btn bg-amber-600 hover:bg-amber-700 text-white text-[11px] py-1 px-3 flex items-center gap-1 shadow-2xs cursor-pointer rounded-lg"
                >
                  <Check size={12} /> Simpan
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Elegant Toolbar */}
      {!readOnly && !isTeacher && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 p-2 bg-stone-50/95 dark:bg-stone-900/95 backdrop-blur-xs border-b border-stone-200 dark:border-stone-800 rounded-t-xl mb-6 shadow-xs">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive('bold')
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Tebal (Bold)"
          >
            <Bold size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive('italic')
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Miring (Italic)"
          >
            <Italic size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive('underline')
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Garis Bawah (Underline)"
          >
            <UnderlineIcon size={15} />
          </button>

          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-1.5" />

          {/* Quick Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Judul Utama (H1)"
          >
            H1
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Sub Judul (H2)"
          >
            H2
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Sub Judul Kecil (H3)"
          >
            H3
          </button>

          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-1.5" />

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive({ textAlign: 'left' })
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Rata Kiri"
          >
            <AlignLeft size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive({ textAlign: 'center' })
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Rata Tengah"
          >
            <AlignCenter size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive({ textAlign: 'justify' })
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Rata Kiri Kanan"
          >
            <AlignJustify size={15} />
          </button>

          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-1.5" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive('bulletList')
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Daftar Poin"
          >
            <List size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive('orderedList')
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Daftar Angka"
          >
            <ListOrdered size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive('blockquote')
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Quote / Kutipan Blok"
          >
            <Quote size={15} />
          </button>

          <button
            type="button"
            onClick={() => toggleHangingIndentHelper(editor.view)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive('paragraph', { hangingIndent: true })
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Indentasi Gantung / Daftar Pustaka (Alt+T / Alt+G / Klik)"
          >
            <Indent size={15} />
          </button>

          <button
            type="button"
            onClick={openNewFootnoteModal}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 cursor-pointer"
            title="Tambah Catatan Kaki (Footnote)"
          >
            <BookmarkPlus size={15} />
          </button>

          {/* Tombol Tabel Data */}
          <button
            type="button"
            onClick={() => {
              if (editor) {
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
              }
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              editor.isActive('table')
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Sisipkan Tabel Data (3x3)"
          >
            <TableIcon size={15} />
          </button>

          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-1" />

          {/* Tombol Cari & Ganti */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleFindReplace();
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              showFindReplace
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
            title="Cari & Ganti Teks (Ctrl+F)"
          >
            <Search size={15} />
          </button>

        </div>
      )}

      {/* Floating Panel Kontrol Tabel saat kursor berada di dalam Tabel (Selalu terlihat di halaman manapun) */}
      {!readOnly && editor && editor.isActive('table') && activeTableCoords && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${activeTableCoords.top}px`,
            left: `${activeTableCoords.left}px`,
            zIndex: 45,
          }}
          className="px-3 py-1.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl border border-stone-300 dark:border-stone-700 shadow-2xl flex flex-wrap items-center gap-1.5 text-xs animate-in fade-in"
        >
          <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 mr-1 flex items-center gap-1 uppercase tracking-wider select-none">
            <TableIcon size={13} /> Tabel:
          </span>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="px-2 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-md font-medium cursor-pointer transition-colors"
            title="Hapus kolom aktif"
          >
            - Kolom
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="px-2 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-md font-medium cursor-pointer transition-colors"
            title="Hapus baris aktif"
          >
            - Baris
          </button>
          <div className="h-3.5 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            className="px-2 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-md font-medium cursor-pointer transition-colors"
            title="Beri / hilangkan baris judul header"
          >
            Judul Kolom
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().mergeCells().run()}
            className="px-2 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-md font-medium cursor-pointer transition-colors"
            title="Gabungkan sel yang dipilih"
          >
            Gabung
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().splitCell().run()}
            className="px-2 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-md font-medium cursor-pointer transition-colors"
            title="Pisahkan sel gabungan"
          >
            Pisah
          </button>
          <div className="h-3.5 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5" />
          {/* Tombol & Popover Warna Background Tabel */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTableColorMenu((prev) => !prev)}
              className={`px-2 py-1 rounded-md font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
                showTableColorMenu
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300'
              }`}
              title="Warna Latar Sel / Baris Tabel"
            >
              <Palette size={13} />
              <span>Warna</span>
            </button>

            {showTableColorMenu && (
              <div
                ref={tableColorMenuRef}
                className="absolute top-full left-0 mt-2 z-50 w-56 p-2.5 bg-white dark:bg-stone-900 rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 animate-in fade-in zoom-in-95 text-stone-800 dark:text-stone-200"
              >
                {/* Header & Target Selector (Sel vs Baris) */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    Warna Latar
                  </span>
                  <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-md text-[10px]">
                    <button
                      type="button"
                      onClick={() => setTableColorTarget('cell')}
                      className={`px-1.5 py-0.5 rounded transition-colors font-medium ${
                        tableColorTarget === 'cell'
                          ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                          : 'text-stone-500 hover:text-stone-800 dark:text-stone-400'
                      }`}
                    >
                      Sel
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableColorTarget('row')}
                      className={`px-1.5 py-0.5 rounded transition-colors font-medium ${
                        tableColorTarget === 'row'
                          ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                          : 'text-stone-500 hover:text-stone-800 dark:text-stone-400'
                      }`}
                    >
                      Baris
                    </button>
                  </div>
                </div>

                {/* Tanpa Warna (Bawaan) */}
                <button
                  type="button"
                  onClick={() => {
                    applyTableColor(null);
                    setShowTableColorMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium transition-colors cursor-pointer mb-2"
                >
                  <div className="w-4 h-4 rounded border border-stone-300 dark:border-stone-600 bg-transparent flex items-center justify-center relative overflow-hidden">
                    <div className="absolute w-[140%] h-[1px] bg-red-500 rotate-45" />
                  </div>
                  <span>Tanpa Warna (Bawaan)</span>
                </button>

                {/* Palet Warna Lembut */}
                <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                  {TABLE_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        applyTableColor(c.value);
                        setShowTableColorMenu(false);
                      }}
                      style={{ backgroundColor: c.value }}
                      className="w-full h-6 rounded-md border border-stone-300 dark:border-stone-650 hover:scale-110 hover:shadow-md transition-all cursor-pointer"
                      title={c.name}
                    />
                  ))}
                </div>

                {/* Input Warna Kustom */}
                <div className="flex items-center gap-2 pt-1.5 border-t border-stone-100 dark:border-stone-800 text-[11px]">
                  <span className="text-stone-500 dark:text-stone-400">Pilih Bebas:</span>
                  <input
                    type="color"
                    onChange={(e) => {
                      applyTableColor(e.target.value);
                    }}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                    title="Pilih warna kustom"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="h-3.5 w-[1px] bg-stone-300 dark:bg-stone-700 mx-0.5" />
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="px-2 py-1 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-md font-medium cursor-pointer transition-colors flex items-center gap-1"
            title="Hapus seluruh tabel"
          >
            <Trash2 size={12} /> Hapus Tabel
          </button>
        </div>
      )}

      {/* Tombol '+' Interaktif & Garis Penanda di Sisi Luar Tabel (Ala Word & Docs) */}
      {!readOnly && !isTeacher && hoverAddBtn && (
        <>
          {/* Garis penanda posisi penyisipan baris/kolom */}
          {hoverAddBtn.type === 'col' ? (
            <div
              style={{
                position: 'fixed',
                left: `${hoverAddBtn.x}px`,
                top: `${hoverAddBtn.lineStart.y}px`,
                height: `${hoverAddBtn.lineEnd.y - hoverAddBtn.lineStart.y}px`,
                width: '2px',
                zIndex: 48,
                pointerEvents: 'none',
              }}
              className="bg-stone-900 dark:bg-stone-100 opacity-60"
            />
          ) : (
            <div
              style={{
                position: 'fixed',
                left: `${hoverAddBtn.lineStart.x}px`,
                top: `${hoverAddBtn.y}px`,
                width: `${hoverAddBtn.lineEnd.x - hoverAddBtn.lineStart.x}px`,
                height: '2px',
                zIndex: 48,
                pointerEvents: 'none',
              }}
              className="bg-stone-900 dark:bg-stone-100 opacity-60"
            />
          )}

          {/* Tombol '+' di Luar Sisi Tabel */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              insertTableColOrRow(hoverAddBtn);
              setHoverAddBtn(null);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              position: 'fixed',
              left: `${hoverAddBtn.x}px`,
              top: `${hoverAddBtn.y}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 60,
            }}
            className="nulis-table-add-btn w-6 h-6 rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 flex items-center justify-center shadow-lg hover:scale-125 transition-transform cursor-pointer border-2 border-white dark:border-stone-900 pointer-events-auto"
            title={hoverAddBtn.type === 'col' ? 'Sisipkan kolom di sini' : 'Sisipkan baris di sini'}
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
        </>
      )}

      {/* Floating HUD Panel Cari & Ganti (Find & Replace) */}
      {showFindReplace && (
        <div
          role="dialog"
          aria-label="Cari dan Ganti Teks"
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed top-16 right-4 sm:right-8 w-80 sm:w-96 z-[60] p-3.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex flex-col gap-2">
            {/* Baris 1: Pencarian */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search size={14} className="absolute left-2.5 text-stone-400 dark:text-stone-500 pointer-events-none" />
                <input
                  ref={findInputRef}
                  type="text"
                  value={findQuery}
                  onChange={(e) => {
                    hasNavigatedRef.current = false;
                    setFindQuery(e.target.value);
                  }}
                  placeholder="Cari kata di naskah..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.shiftKey) {
                        handlePrevMatch();
                      } else {
                        handleNextMatch();
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCloseFindReplace();
                    }
                  }}
                  className="editorial-input w-full pl-8 pr-20 py-1.5 text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none"
                />
                <span className="absolute right-2 text-[10px] font-medium text-stone-400 dark:text-stone-500 select-none">
                  {findMatches.length > 0
                    ? `${currentMatchIndex + 1} dari ${findMatches.length}`
                    : findQuery.trim()
                    ? '0 hasil'
                    : ''}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMatch}
                  disabled={findMatches.length === 0}
                  className="p-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="Sebelumnya (Shift+Enter)"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMatch}
                  disabled={findMatches.length === 0}
                  className="p-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="Berikutnya (Enter)"
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleCloseFindReplace}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Baris 2: Penggantian Kata */}
            {!readOnly && !isTeacher && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <Replace size={14} className="absolute left-2.5 text-stone-400 dark:text-stone-500 pointer-events-none" />
                  <input
                    type="text"
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    placeholder="Ganti dengan..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleReplaceCurrent();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCloseFindReplace();
                      }
                    }}
                    className="editorial-input w-full pl-8 pr-2.5 py-1.5 text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleReplaceCurrent}
                    disabled={findMatches.length === 0}
                    className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-xs py-1.5 px-2.5 rounded-lg disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    title="Ganti kecocokan saat ini"
                  >
                    Ganti
                  </button>
                  <button
                    type="button"
                    onClick={handleReplaceAll}
                    disabled={findMatches.length === 0}
                    className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 text-xs py-1.5 px-2.5 rounded-lg font-medium shadow-xs disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    title="Ganti semua kecocokan sekaligus"
                  >
                    Ganti Semua
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Area Konten Editor (Tetap di section utama, tanpa canvas tambahan) */}
      <div
        onMouseMove={handleEditorMouseMove}
        onMouseLeave={(e) => {
          const related = e.relatedTarget as HTMLElement | null;
          if (related && related.closest('.nulis-table-add-btn')) return;
          if (hoverAddBtn) {
            const dist = Math.hypot(e.clientX - hoverAddBtn.x, e.clientY - hoverAddBtn.y);
            if (dist < 50) return;
          }
          setHoverAddBtn(null);
        }}
        className={`editorial-content-area py-2 px-1 ${layoutMode === 'kertas' ? 'mode-kertas' : 'mode-web'}`}
      >
        <EditorContent editor={editor} />

        {/* Catatan Kaki (Footnotes) & Nomor Halaman: Mode Kertas menampilkan footnote halaman terakhir & nomor halaman di footer */}
        {layoutMode === 'kertas' && (
          <div className="nulis-page-footer mt-6 pt-2">
            {(() => {
              const lastPageFootnotes = paginationData.pageFootnotes[paginationData.totalPages] || [];
              if (lastPageFootnotes.length === 0) return null;
              return (
                <>
                  <div className="nulis-page-footer-divider" />
                  <div className="flex flex-col gap-0.5 mb-1">
                    {lastPageFootnotes.map((fn) => (
                      <div
                        key={fn.id}
                        onClick={() => !readOnly && openEditFootnote(fn)}
                        className={`nulis-page-footer-item ${!readOnly ? 'cursor-pointer' : ''}`}
                        title={!readOnly ? 'Klik untuk mengubah sitasi sumber' : ''}
                      >
                        <span className="font-bold shrink-0 text-[11px] leading-tight">[{fn.index}]</span>
                        <span className="flex-1 text-[11px] leading-snug">{fn.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            {/* Nomor halaman terakhir di footer (angka saja, tanpa kata 'Halaman') */}
            <div className="nulis-page-footer-num">
              <span>{paginationData.totalPages}</span>
            </div>
          </div>
        )}

        {/* Catatan Kaki (Footnotes): Mode Web menampilkan seluruh catatan kaki di akhir dokumen */}
        {layoutMode === 'web' && (
          (() => {
            const allFootnotes = Object.values(paginationData.pageFootnotes).flat();
            if (allFootnotes.length === 0 && footnotes.length === 0) return null;
            const displayList = allFootnotes.length > 0 ? allFootnotes : footnotes;
            return (
              <div className="mt-8 pt-4 border-t border-stone-200 dark:border-stone-800">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1.5">
                  <BookmarkCheck size={13} className="text-stone-700 dark:text-stone-300" />
                  <span>Catatan Kaki (Footnotes)</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {displayList.map((fn) => (
                    <div
                      key={fn.id}
                      onClick={() => !readOnly && openEditFootnote(fn)}
                      className={`text-xs text-stone-700 dark:text-stone-300 font-serif-literary py-1 px-1.5 rounded-md transition-colors flex items-baseline gap-1.5 ${
                        !readOnly ? 'hover:bg-stone-100 dark:hover:bg-stone-800/60 cursor-pointer group' : ''
                      }`}
                    >
                      <span className="font-bold text-stone-900 dark:text-stone-100 text-[11px] shrink-0 leading-tight">[{fn.index}]</span>
                      <span className="flex-1 leading-snug text-xs">{fn.text}</span>
                      {!readOnly && (
                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-stone-400 font-sans shrink-0 hover:text-stone-700 dark:hover:text-stone-200">
                          Ubah
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Floating Menu Slash Command (/) */}
      {slashMenuOpen && filteredSlashItems.length > 0 && (
        <div
          ref={slashMenuContainerRef}
          style={{ top: `${slashMenuCoords.top}px`, left: `${slashMenuCoords.left}px` }}
          className="fixed z-50 editorial-card bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-1.5 max-w-xs w-64 shadow-2xl border border-stone-200 dark:border-stone-800 rounded-xl animate-in zoom-in-95 max-h-72 overflow-y-auto"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-800 mb-1">
            Format Teks {slashQuery ? `(filter: /${slashQuery})` : ''}
          </div>
          <div className="flex flex-col gap-0.5">
            {filteredSlashItems.map((item, idx) => {
              const isSelected = idx === slashSelectedIndex;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    slashItemRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseEnter={() => {
                    setSlashSelectedIndex(idx);
                    slashMenuStateRef.current.selectedIndex = idx;
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeSlashOption(item);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                      : 'text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold leading-tight">{item.title}</div>
                    <div className={`text-[10px] truncate ${isSelected ? 'text-stone-300 dark:text-stone-600' : 'text-stone-400 dark:text-stone-500'}`}>
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Popup Komentar Guru saat Guru menyeleksi kata */}
      {isTeacher && showTeacherCommentModal && (
        <div className="absolute top-16 right-4 z-50 editorial-card p-4 bg-white dark:bg-stone-900 max-w-sm w-full shadow-2xl animate-in zoom-in-95 border border-stone-300 dark:border-stone-700">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2 mb-3">
            <span className="font-bold text-xs flex items-center gap-1.5 text-stone-800 dark:text-stone-100">
              <MessageSquarePlus size={15} className="text-blue-600 dark:text-blue-400" /> Beri Catatan Koreksi
            </span>
            <button
              onClick={handleCloseTeacherModal}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-0.5 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 p-2.5 rounded-lg text-xs font-serif-literary truncate mb-3 border border-amber-200 dark:border-amber-800/80">
            "{selectedText}"
          </div>

          {/* Kolom Input Komentar Guru dengan Tag di dalamnya */}
          <div className="relative mb-3 border border-stone-200 dark:border-stone-700 rounded-xl bg-stone-50/80 dark:bg-stone-850 p-2.5 focus-within:border-stone-400 dark:focus-within:border-stone-600 focus-within:bg-white dark:focus-within:bg-stone-900 transition-all">
            {/* Tag Badges di dalam kolom input */}
            {selectedTeacherTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-1.5 border-b border-stone-200/60 dark:border-stone-700/60">
                {selectedTeacherTags.map((tagId) => {
                  const opt = TEACHER_FEEDBACK_OPTIONS.find((o) => o.id === tagId);
                  return (
                    <span
                      key={tagId}
                      className="inline-flex items-center gap-1 text-[11px] leading-tight px-2 py-0.5 rounded bg-stone-200/80 dark:bg-stone-750 text-stone-800 dark:text-stone-200 font-medium border border-stone-300/80 dark:border-stone-650 select-none"
                    >
                      <span>{opt ? opt.tag : tagId}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeacherTags((prev) => prev.filter((id) => id !== tagId));
                        }}
                        className="hover:text-red-500 rounded p-0.5 cursor-pointer opacity-70 hover:opacity-100"
                        title="Hapus tag"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <textarea
              ref={commentTextareaRef}
              value={commentText}
              onChange={(e) => handleTeacherCommentChange(e.target.value)}
              onKeyDown={(e) => {
                if (teacherSlashOpen && filteredTeacherOptions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = (teacherSlashSelectedIndex + 1) % filteredTeacherOptions.length;
                    setTeacherSlashSelectedIndex(next);
                    const container = teacherSlashDropdownRef.current;
                    const item = teacherSlashItemRefs.current[next];
                    if (container && item) {
                      if (item.offsetTop < container.scrollTop) {
                        container.scrollTop = item.offsetTop;
                      } else if (item.offsetTop + item.offsetHeight > container.scrollTop + container.clientHeight) {
                        container.scrollTop = item.offsetTop + item.offsetHeight - container.clientHeight;
                      }
                    }
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = (teacherSlashSelectedIndex - 1 + filteredTeacherOptions.length) % filteredTeacherOptions.length;
                    setTeacherSlashSelectedIndex(prev);
                    const container = teacherSlashDropdownRef.current;
                    const item = teacherSlashItemRefs.current[prev];
                    if (container && item) {
                      if (item.offsetTop < container.scrollTop) {
                        container.scrollTop = item.offsetTop;
                      } else if (item.offsetTop + item.offsetHeight > container.scrollTop + container.clientHeight) {
                        container.scrollTop = item.offsetTop + item.offsetHeight - container.clientHeight;
                      }
                    }
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    const chosen = filteredTeacherOptions[teacherSlashSelectedIndex];
                    if (chosen) {
                      if (e.ctrlKey || e.metaKey) {
                        handleInsertTeacherTemplate(chosen);
                      } else {
                        handleInsertTeacherTag(chosen);
                      }
                    }
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setTeacherSlashOpen(false);
                    return;
                  }
                }

                if (e.key === 'Enter' && !e.shiftKey && !teacherSlashOpen) {
                  e.preventDefault();
                  applyTeacherComment();
                }
              }}
              placeholder={
                selectedTeacherTags.length > 0
                  ? "Tulis catatan atau ketik / untuk tag lain (Enter untuk menerapkan)..."
                  : "Tulis catatan koreksi atau ketik / untuk variabel jenis penilaian..."
              }
              spellCheck={false}
              lang="id"
              className="w-full text-xs h-20 bg-transparent text-stone-900 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 border-none outline-none resize-none p-0.5 leading-relaxed"
              autoFocus
            />

            {/* Dropdown Floating Menu Variabel Rubrik saat guru ketik / */}
            {teacherSlashOpen && filteredTeacherOptions.length > 0 && (
              <div 
                ref={teacherSlashDropdownRef}
                onWheel={(e) => e.stopPropagation()}
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-2xl p-1.5 max-h-56 overflow-y-auto overscroll-contain animate-in zoom-in-95"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-800 mb-1 flex items-center justify-between">
                  <span>Pilih Variabel Rubrik (/{teacherSlashQuery})</span>
                  <span className="text-[9px] text-stone-400 font-normal">Enter: Tag • Ctrl+Enter: Template</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {filteredTeacherOptions.map((opt, idx) => {
                    const isSel = idx === teacherSlashSelectedIndex;
                    return (
                      <button
                        key={opt.id}
                        ref={(el) => { teacherSlashItemRefs.current[idx] = el; }}
                        type="button"
                        onMouseEnter={() => setTeacherSlashSelectedIndex(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (e.ctrlKey || e.metaKey) {
                            handleInsertTeacherTemplate(opt);
                          } else {
                            handleInsertTeacherTag(opt);
                          }
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                          isSel
                            ? 'bg-stone-900 text-white dark:bg-stone-800 dark:text-stone-100 shadow-xs'
                            : 'text-stone-800 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold text-xs leading-tight">{opt.label}</div>
                          <div className={`text-[10px] truncate ${isSel ? 'text-stone-300 dark:text-stone-400' : 'text-stone-400 dark:text-stone-500'}`}>
                            {opt.template}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            isSel ? 'bg-stone-800 text-stone-200 dark:bg-stone-700 dark:text-stone-200' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                          }`}>
                            {opt.tag}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={removeTeacherHighlight}
              className="editorial-btn bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70 text-xs py-1.5 px-3 cursor-pointer"
              title="Hapus highlight"
            >
              <Trash2 size={13} />
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCloseTeacherModal}
                className="editorial-btn bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs py-1.5 px-3 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => applyTeacherComment()}
                className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 text-xs py-1.5 px-3 cursor-pointer font-medium"
              >
                Terapkan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup Catatan Kaki (Footnote) */}
      {footnoteModalState.isOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="editorial-card w-full max-w-md bg-white dark:bg-stone-900 p-6 shadow-2xl border border-stone-300 dark:border-stone-800 rounded-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-sm">
                <BookmarkCheck size={17} className="text-stone-700 dark:text-stone-300" />
                <span>{footnoteModalState.isEdit ? 'Ubah Catatan Kaki' : 'Tambah Catatan Kaki (Footnote)'}</span>
              </div>
              <button
                type="button"
                onClick={() => setFootnoteModalState({ isOpen: false, isEdit: false, id: '', text: '' })}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                Isi Sitasi / Catatan Sumber
              </label>

              {/* Saran Sumber yang Pernah Dikutip */}
              {citationHistory.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-1.5 flex items-center gap-1">
                    <History size={12} />
                    <span>Sumber yang Pernah Dikutip:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {citationHistory.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFootnoteModalState((prev) => ({ ...prev, text: item }))}
                        className="text-left text-[11px] font-serif-literary bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 px-2.5 py-1 rounded-md border border-stone-200/60 dark:border-stone-700/60 transition-colors cursor-pointer truncate max-w-full"
                        title={`Gunakan: ${item}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                ref={footnoteInputRef}
                rows={3}
                value={footnoteModalState.text}
                onChange={(e) => setFootnoteModalState((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="Cantumkan sumber"
                className="editorial-input w-full p-3 text-xs font-serif-literary leading-relaxed resize-none focus:outline-none bg-stone-50 dark:bg-[#18181B] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveFootnote();
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {footnoteModalState.isEdit ? (
                <button
                  type="button"
                  onClick={handleDeleteFootnote}
                  className="editorial-btn bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70 text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={13} /> Hapus
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFootnoteModalState({ isOpen: false, isEdit: false, id: '', text: '' })}
                  className="editorial-btn bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs py-2 px-3 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveFootnote}
                  className="editorial-btn bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 text-xs py-2 px-4 font-semibold shadow-xs cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Outline Icon di Pojok Kiri Atas (Persis Google Docs, Proporsional & Tanpa Teks) */}
      {!isTeacher && !isTocOpen && (
        <button
          ref={tocToggleBtnRef}
          type="button"
          onClick={() => setIsTocOpen(true)}
          className="fixed top-22 left-6 z-30 w-10 h-10 rounded-xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-md shadow-md border border-stone-200/90 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          title="Buka Daftar Isi & Kerangka Bab"
        >
          <ListTree size={18} className="text-stone-600 dark:text-stone-300 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Drawer / Panel Navigasi Daftar Isi & Kerangka Bab (Membuka dari Kiri Atas) */}
      {!isTeacher && isTocOpen && (
        <div
          ref={tocDrawerRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed top-20 left-6 z-40 w-80 max-h-[calc(100vh-140px)] flex flex-col bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in slide-in-from-left-4 fade-in"
        >
          {/* Header Panel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50">
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-xs">
              <BookOpen size={16} className="text-stone-700 dark:text-stone-300" />
              <span>Daftar Isi & Kerangka Bab</span>
              {tocHeadings.length > 0 && (
                <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 bg-stone-200/70 dark:bg-stone-700 px-1.5 py-0.5 rounded-full">
                  {tocHeadings.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsTocOpen(false)}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 rounded-lg cursor-pointer transition-colors"
              title="Tutup Daftar Isi"
            >
              <X size={15} />
            </button>
          </div>

          {/* Opsi Sisipkan Daftar Isi ke Halaman Depan Naskah */}
          {!readOnly && (
            <div className="p-3 bg-stone-50 dark:bg-stone-850/80 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-stone-600 dark:text-stone-300 leading-tight">
                {hasDocToc ? 'Daftar isi terpasang di naskah depan' : 'Pasang daftar isi di halaman depan'}
              </div>
              {!hasDocToc ? (
                <button
                  type="button"
                  onClick={insertFrontDocToc}
                  className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 rounded-lg text-xs font-semibold shrink-0 cursor-pointer shadow-xs transition-colors"
                  title="Sisipkan daftar isi otomatis dan pemisah halaman di depan naskah"
                >
                  + Pasang di Depan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={removeDocToc}
                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 rounded-lg text-xs font-medium shrink-0 cursor-pointer transition-colors"
                  title="Hapus blok daftar isi dari naskah"
                >
                  Hapus dari Depan
                </button>
              )}
            </div>
          )}

          {/* List Judul / Headings */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 divide-y divide-stone-50 dark:divide-stone-850">
            {tocHeadings.length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center justify-center">
                <ListTree size={32} className="text-stone-300 dark:text-stone-600 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Belum ada kerangka bab
                </p>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 leading-relaxed max-w-[200px]">
                  Gunakan format <strong className="text-stone-600 dark:text-stone-300">Heading 1</strong>, <strong className="text-stone-600 dark:text-stone-300">2</strong>, atau <strong className="text-stone-600 dark:text-stone-300">3</strong> (atau ketik <code className="bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded text-[10px]">/h1</code>) untuk menyusun bab secara otomatis.
                </p>
              </div>
            ) : (
              tocHeadings.map((h) => {
                const indentClass =
                  h.level === 1
                    ? 'pl-2 font-bold text-stone-900 dark:text-stone-100'
                    : h.level === 2
                    ? 'pl-5 font-semibold text-stone-700 dark:text-stone-200'
                    : 'pl-8 font-normal text-stone-600 dark:text-stone-400';

                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => jumpToHeading(h.pos)}
                    className={`w-full text-left py-2 px-2.5 rounded-lg text-xs hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-between gap-2 transition-colors cursor-pointer group ${indentClass}`}
                    title={`Lompat ke "${h.text}" (Hal ${h.page})`}
                  >
                    <span className="truncate flex-1 group-hover:text-stone-950 dark:group-hover:text-white">
                      {h.text}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded group-hover:bg-stone-200 dark:group-hover:bg-stone-700 transition-colors">
                      Hal {h.page}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Panel */}
          {tocHeadings.length > 0 && (
            <div className="px-3 py-2 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 text-[10px] text-stone-400 dark:text-stone-500 text-center">
              Klik judul bab untuk melompat langsung ke halaman terkait
            </div>
          )}
        </div>
      )}

      {/* Floating Minimalist Layout Mode Switcher (Pojok Kiri Bawah Window) - Hanya untuk Siswa */}
      {!isTeacher && !hasDocToc && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-1 rounded-xl shadow-xl border border-stone-200/90 dark:border-stone-700 transition-all duration-200">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleLayoutChange('web')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              layoutMode === 'web'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 dark:text-stone-200 dark:hover:text-white dark:hover:bg-stone-800'
            }`}
            title="Tampilan Web (Mengalir)"
          >
            {/* Persegi Panjang Berdiri */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2.5" width="14" height="19" rx="2" fill="currentColor" fillOpacity={layoutMode === 'web' ? 0.25 : 0.12} />
            </svg>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleLayoutChange('kertas')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              layoutMode === 'kertas'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 dark:text-stone-200 dark:hover:text-white dark:hover:bg-stone-800'
            }`}
            title="Tampilan Lembaran Kertas (A4)"
          >
            {/* Persegi Panjang Terbagi Secara Horizontal */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2.5" width="14" height="19" rx="2" fill="currentColor" fillOpacity={layoutMode === 'kertas' ? 0.25 : 0.12} />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Status Bar Minimalist: Mengambang untuk Siswa, Tersemat Rapi (Inline) untuk Guru agar Tidak Bertumpuk */}
      {!isTeacher ? (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xl border border-stone-200/90 dark:border-stone-800 text-xs text-stone-400 dark:text-stone-500 font-sans select-none transition-all duration-200">
          {layoutMode === 'kertas' && (
            <>
              <span className="text-stone-700 dark:text-stone-200 font-medium">
                Hal {activePage} dari {Math.max(1, paginationData.totalPages)}
              </span>
              <span>·</span>
            </>
          )}
          <span className="text-stone-600 dark:text-stone-300 font-medium">
            {editorStats.words.toLocaleString('id-ID')} kata
          </span>
          <span>·</span>
          <span>{editorStats.characters.toLocaleString('id-ID')} karakter</span>
        </div>
      ) : (
        <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 dark:text-stone-500 font-sans select-none">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[11px] font-semibold">
              Format: {layoutMode === 'kertas' ? 'Kertas A4' : 'Web Mengalir'}
            </span>
            {layoutMode === 'kertas' && (
              <span className="text-stone-700 dark:text-stone-200 font-medium text-xs">
                Halaman {activePage} dari {Math.max(1, paginationData.totalPages)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-600 dark:text-stone-300 font-medium">
              {editorStats.words.toLocaleString('id-ID')} kata
            </span>
            <span>·</span>
            <span>{editorStats.characters.toLocaleString('id-ID')} karakter</span>
          </div>
        </div>
      )}
    </div>
  );
};

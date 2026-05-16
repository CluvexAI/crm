import React, { useState, useRef, useCallback, useEffect } from 'react';

const FONT_FAMILIES = [
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Tahoma', value: 'Tahoma, sans-serif' },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
];

const FONT_SIZES = [
  { label: '10px', value: '1' },
  { label: '12px', value: '2' },
  { label: '14px', value: '3' },
  { label: '16px', value: '4' },
  { label: '18px', value: '5' },
  { label: '20px', value: '6' },
  { label: '24px', value: '7' },
  { label: '28px', value: '8' },
  { label: '32px', value: '9' },
  { label: '36px', value: '10' },
  { label: '42px', value: '11' },
  { label: '48px', value: '12' },
];

const TEXT_COLORS = [
  '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
  '#FF0000', '#FF6600', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF',
  '#FF00FF', '#800000', '#808000', '#008000', '#008080', '#000080',
  '#800080', '#C0C0C0', '#FF8080', '#FFCC00', '#80FF80', '#80FFFF',
  '#8080FF', '#FF80FF', '#400000', '#404000', '#004000', '#004040',
  '#000040', '#400040', '#202020', '#804000', '#408000', '#004080',
  '#400080', '#600000', '#606000', '#006000', '#006060', '#000060',
  '#600060', '#303030', '#A05000', '#50A000', '#0050A0', '#5000A0',
  '#700000', '#707000', '#007000', '#007070', '#000070', '#700070',
];

const BG_COLORS = [
  '#FFFFFF', '#F0F0F0', '#E0E0E0', '#CCCCCC', '#AAAAAA', '#888888',
  '#FFCCCC', '#FFDDCC', '#FFFFCC', '#CCFFCC', '#CCFFFF', '#CCCCFF',
  '#FFCCFF', '#FFAAAA', '#FFDDAA', '#AAFFAA', '#AAFFFF', '#AAAAFF',
  '#FFAAFF', '#FF7777', '#FFBB77', '#77FF77', '#77FFFF', '#7777FF',
  '#FF77FF', '#FF5555', '#FFAA55', '#55FF55', '#55FFFF', '#5555FF',
  '#FF55FF', '#FF3333', '#FF9933', '#33FF33', '#33FFFF', '#3333FF',
  '#FF33FF', '#DDCCCC', '#CCDDCC', '#CCCCDD', '#EEDDCC', '#CCEEDD',
];

const SPECIAL_CHARS = {
  currency: ['EUR', '$', 'GBP', 'YEN', 'BTC', 'INR', 'RUB', 'KRW', 'VND', 'ILS', 'PHP', 'NGN', 'UAH', 'TUG', 'KOP', 'PES', 'PYG', 'GUA'],
  text: ['(c)', '(R)', '(TM)', 'deg', '...', '*', '+', '++', 'Pilcrow', 'sect', 'No.', 'star', 'hollow', 'mid', 'dier', 'acute', '?', '!', 'not', '+-'],
  quotes: ['"', '"', '"', "'", "'", "'", 'low9', 'right', 'left', 'langle', 'rangle', 'prime', 'dprime', 'revers', 'low92', 'low93', 'lqu', 'rqu', 'lp', 'rp'],
  math: ['inf', '!=', '~=', '==', '+-', '*', '/', 'sqrt', 'int', 'pi', 'theta', 'Omega', 'sum', 'prod', 'part', 'Delta', 'nabla', 'elem', 'notElem', 'forall'],
  symbols: ['star', 'check', 'cross', 'recycle', 'gear', 'warn', 'question', 'excl', 'exclaim', 'heart', 'diamond', 'spade', 'club', 'plane', 'phone', 'email', 'female', 'male', 'bolt', 'fire'],
  arrows: ['left', 'right', 'up', 'down', 'lr', 'ud', 'implies', 'Leftarrow', 'iff', 'Updownarrow', 'hookL', 'hookR', 'curveL', 'curveR', 'dash', 'harp', 'downB', 'upB', 'downZ', 'loop'],
};

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const editorRef = useRef(null);
  const plainTextRef = useRef(null);
  const debounceRef = useRef(null);
  const isInitialized = useRef(false);
  const [savedSelection, setSavedSelection] = useState(null);
  
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showSpecialChars, setShowSpecialChars] = useState(false);
  const [showSourceCode, setShowSourceCode] = useState(false);
  const [isPlainMode, setIsPlainMode] = useState(false);

  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkTarget, setLinkTarget] = useState('_blank');
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableHeader, setTableHeader] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageWidth, setImageWidth] = useState('');
  const [sourceCode, setSourceCode] = useState('');

  useEffect(() => {
    if (!isInitialized.current && editorRef.current) {
      editorRef.current.innerHTML = value || '';
      isInitialized.current = true;
    }
  }, []);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      setSavedSelection({
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      });
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelection) {
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(savedSelection.startContainer, savedSelection.startOffset);
        range.setEnd(savedSelection.endContainer, savedSelection.endOffset);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        console.log('Could not restore selection');
      }
    }
  }, [savedSelection]);

  const debouncedOnChange = useCallback((content) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onChange(content);
    }, 300);
  }, [onChange]);

  const handleEditorInput = (e) => {
    debouncedOnChange(e.currentTarget.innerHTML);
  };

  const execCommand = (command, value = null) => {
    restoreSelection();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      debouncedOnChange(editorRef.current.innerHTML);
    }
  };

  const handleToolbarButton = (e, command, value = null) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    saveSelection();
    execCommand(command, value);
  };

  const handleSelectChange = (e, command, value) => {
    saveSelection();
    setTimeout(() => {
      execCommand(command, value);
      e.target.value = '';
    }, 10);
  };

  const handleColorSelect = (color, isBackground = false) => {
    execCommand(isBackground ? 'hiliteColor' : 'foreColor', color);
    setShowColorPicker(null);
  };

  const handleInsertLink = (e) => {
    e.preventDefault();
    if (linkUrl) {
      restoreSelection();
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && selection.toString()) {
        document.execCommand('createLink', false, linkUrl);
        const links = editorRef.current?.querySelectorAll('a');
        if (links) {
          links.forEach(link => {
            link.target = linkTarget;
            link.rel = linkTarget === '_blank' ? 'noopener noreferrer' : '';
          });
        }
      } else {
        const linkHtml = `<a href="${linkUrl}" target="${linkTarget}" rel="${linkTarget === '_blank' ? 'noopener noreferrer' : ''}">${linkText || linkUrl}</a>`;
        document.execCommand('insertHTML', false, linkHtml);
      }
      debouncedOnChange(editorRef.current.innerHTML);
      setShowLinkModal(false);
      setLinkUrl('');
      setLinkText('');
    }
  };

  const handleRemoveLink = (e) => {
    e.preventDefault();
    execCommand('unlink');
  };

  const handleInsertTable = (e) => {
    e.preventDefault();
    let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
    if (tableHeader) {
      tableHtml += '<thead><tr>';
      for (let i = 0; i < tableCols; i++) {
        tableHtml += `<th style="border: 1px solid #ccc; padding: 8px; background: #f0f0f0; text-align: left;">Header ${i + 1}</th>`;
      }
      tableHtml += '</tr></thead>';
    }
    tableHtml += '<tbody>';
    for (let r = 0; r < tableRows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < tableCols; c++) {
        tableHtml += `<td style="border: 1px solid #ccc; padding: 8px;">Cell ${r + 1}-${c + 1}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table>';
    document.execCommand('insertHTML', false, tableHtml);
    debouncedOnChange(editorRef.current.innerHTML);
    setShowTableModal(false);
  };

  const handleInsertImage = (e) => {
    e.preventDefault();
    if (imageUrl) {
      restoreSelection();
      const widthAttr = imageWidth ? ` width="${imageWidth}"` : '';
      const imgHtml = `<img src="${imageUrl}" alt="${imageAlt}"${widthAttr} style="max-width: 100%; height: auto;" />`;
      document.execCommand('insertHTML', false, imgHtml);
      debouncedOnChange(editorRef.current.innerHTML);
      setShowImageModal(false);
      setImageUrl('');
      setImageAlt('');
      setImageWidth('');
    }
  };

  const handleInsertSpecialChar = (char, e) => {
    e.preventDefault();
    restoreSelection();
    document.execCommand('insertText', false, char);
    editorRef.current?.focus();
    debouncedOnChange(editorRef.current.innerHTML);
  };

  const handleSourceCodeApply = (e) => {
    e.preventDefault();
    if (editorRef.current && sourceCode) {
      editorRef.current.innerHTML = sourceCode;
      onChange(sourceCode);
      setShowSourceCode(false);
    }
  };

  const handlePlainToggle = (mode) => {
    if (mode === 'plain') {
      if (editorRef.current) {
        plainTextRef.current = editorRef.current.innerText || '';
      }
      setIsPlainMode(true);
    } else {
      if (editorRef.current && plainTextRef.current !== undefined) {
        editorRef.current.innerText = plainTextRef.current;
        onChange(plainTextRef.current);
      }
      setIsPlainMode(false);
    }
  };

  const ColorPickerModal = ({ isBackground }) => (
    <div style={{
      position: 'absolute',
      background: 'white',
      border: '1px solid #ccc',
      borderRadius: 8,
      padding: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 10000,
      width: 280,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, marginBottom: 10 }}>
        {(isBackground ? BG_COLORS : TEXT_COLORS).map((color, idx) => (
          <button
            key={idx}
            onMouseDown={(e) => {
              e.preventDefault();
              handleColorSelect(color, isBackground);
            }}
            style={{
              width: 24,
              height: 24,
              background: color,
              border: color === '#FFFFFF' ? '1px solid #ccc' : 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
            title={color}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          onChange={(e) => handleColorSelect(e.target.value, isBackground)}
          style={{ width: 40, height: 30, border: 'none', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 12 }}>Custom</span>
      </div>
    </div>
  );

  const LinkModal = () => (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }} onMouseDown={(e) => e.preventDefault()}>
      <div className="modal" style={{ background: 'white', borderRadius: 8, width: 400, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 15px' }}>Insert Hyperlink</h3>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>URL</label>
          <input className="form-control" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>Display Text</label>
          <input className="form-control" value={linkText} onChange={e => setLinkText(e.target.value)} placeholder="Link text" />
        </div>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={linkTarget === '_blank'} onChange={e => setLinkTarget(e.target.checked ? '_blank' : '_self')} />
            Open in new tab
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setShowLinkModal(false)}>Cancel</button>
          <button className="btn btn-primary" onMouseDown={handleInsertLink}>Insert</button>
        </div>
      </div>
    </div>
  );

  const TableModal = () => (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }} onMouseDown={(e) => e.preventDefault()}>
      <div className="modal" style={{ background: 'white', borderRadius: 8, width: 350, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 15px' }}>Insert Table</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>Rows</label>
            <input className="form-control" type="number" min="1" max="20" value={tableRows} onChange={e => setTableRows(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>Columns</label>
            <input className="form-control" type="number" min="1" max="10" value={tableCols} onChange={e => setTableCols(parseInt(e.target.value) || 1)} />
          </div>
        </div>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={tableHeader} onChange={e => setTableHeader(e.target.checked)} />
            Include header row
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setShowTableModal(false)}>Cancel</button>
          <button className="btn btn-primary" onMouseDown={handleInsertTable}>Insert</button>
        </div>
      </div>
    </div>
  );

  const ImageModal = () => (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }} onMouseDown={(e) => e.preventDefault()}>
      <div className="modal" style={{ background: 'white', borderRadius: 8, width: 400, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 15px' }}>Insert Image</h3>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>Image URL</label>
          <input className="form-control" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
        </div>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>Alt Text</label>
          <input className="form-control" value={imageAlt} onChange={e => setImageAlt(e.target.value)} placeholder="Image description" />
        </div>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5, fontSize: 12 }}>Width (optional)</label>
          <input className="form-control" value={imageWidth} onChange={e => setImageWidth(e.target.value)} placeholder="e.g. 300px or 50%" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setShowImageModal(false)}>Cancel</button>
          <button className="btn btn-primary" onMouseDown={handleInsertImage}>Insert</button>
        </div>
      </div>
    </div>
  );

  const SpecialCharsModal = () => {
    const [activeTab, setActiveTab] = useState('currency');
    const tabs = ['currency', 'text', 'quotes', 'math', 'symbols', 'arrows'];
    
    return (
      <div style={{
        position: 'absolute',
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 15,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 10000,
        width: 320,
      }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                border: 'none',
                borderRadius: 4,
                background: activeTab === tab ? 'var(--primary)' : '#f0f0f0',
                color: activeTab === tab ? 'white' : '#333',
                cursor: 'pointer',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {SPECIAL_CHARS[activeTab].map((char, idx) => (
            <button
              key={idx}
              onMouseDown={(e) => handleInsertSpecialChar(char, e)}
              style={{
                padding: 8,
                fontSize: 14,
                border: '1px solid #eee',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {char}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const SourceCodeModal = () => (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }} onMouseDown={(e) => e.preventDefault()}>
      <div className="modal" style={{ background: 'white', borderRadius: 8, width: 600, height: 400, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 15px' }}>Edit HTML Source</h3>
        <textarea
          className="form-control"
          value={sourceCode || editorRef.current?.innerHTML || ''}
          onChange={e => setSourceCode(e.target.value)}
          style={{ width: '100%', height: 280, fontFamily: 'monospace', fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 15 }}>
          <button className="btn btn-ghost" onClick={() => setShowSourceCode(false)}>Cancel</button>
          <button className="btn btn-primary" onMouseDown={handleSourceCodeApply}>Apply</button>
        </div>
      </div>
    </div>
  );

  const selectStyle = {
    height: 26,
    fontSize: 11,
    padding: '2px 4px',
    border: '1px solid #ccc',
    borderRadius: 4,
    backgroundColor: '#fff',
    cursor: 'pointer',
    minWidth: 70,
  };

  const renderToolbar = () => (
    <div style={{ 
      display: 'flex', 
      gap: 4, 
      padding: '10px 8px', 
      borderBottom: '1px solid #ddd',
      background: '#f0f4f8',
      borderRadius: '8px 8px 0 0',
      flexWrap: 'wrap',
      alignItems: 'center',
      width: '100%',
    }}>
      <select 
        className="form-control"
        style={selectStyle}
        onChange={(e) => handleSelectChange(e, 'formatBlock', e.target.value)}
      >
        <option value="">Format</option>
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="h5">Heading 5</option>
        <option value="h6">Heading 6</option>
        <option value="blockquote">Quote</option>
        <option value="pre">Code</option>
      </select>

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />

      <select 
        className="form-control"
        style={{ ...selectStyle, minWidth: 100 }}
        onChange={(e) => handleSelectChange(e, 'fontName', e.target.value)}
      >
        <option value="">Font</option>
        {FONT_FAMILIES.map(f => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.name}</option>
        ))}
      </select>

      <select 
        className="form-control"
        style={{ ...selectStyle, minWidth: 60 }}
        onChange={(e) => handleSelectChange(e, 'fontSize', e.target.value)}
      >
        <option value="">Size</option>
        {FONT_SIZES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />

      <button type="button" className="btn btn-sm btn-ghost" title="Bold" onMouseDown={(e) => handleToolbarButton(e, 'bold')} style={{ fontWeight: 'bold', width: 28, padding: '4px 8px' }}>B</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Italic" onMouseDown={(e) => handleToolbarButton(e, 'italic')} style={{ fontStyle: 'italic', width: 28, padding: '4px 8px' }}>I</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Underline" onMouseDown={(e) => handleToolbarButton(e, 'underline')} style={{ textDecoration: 'underline', width: 28, padding: '4px 8px' }}>U</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Strikethrough" onMouseDown={(e) => handleToolbarButton(e, 'strikeThrough')} style={{ textDecoration: 'line-through', width: 28, padding: '4px 8px' }}>S</button>

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />

      <div style={{ position: 'relative', display: 'inline-block', zIndex: 9999 }}>
        <button type="button" className="btn btn-sm btn-ghost" title="Text Color" onMouseDown={(e) => { e.preventDefault(); setShowColorPicker(showColorPicker === 'text' ? null : 'text'); }} style={{ padding: '4px 8px' }}>
          <span style={{ color: '#ff0000', fontWeight: 'bold' }}>A</span>
        </button>
        {showColorPicker === 'text' && <ColorPickerModal isBackground={false} />}
      </div>

      <div style={{ position: 'relative', display: 'inline-block', zIndex: 9999 }}>
        <button type="button" className="btn btn-sm btn-ghost" title="Highlight" onMouseDown={(e) => { e.preventDefault(); setShowColorPicker(showColorPicker === 'bg' ? null : 'bg'); }} style={{ padding: '4px 8px' }}>
          <span style={{ background: '#ffff00', padding: '2px 4px', borderRadius: 2 }}>A</span>
        </button>
        {showColorPicker === 'bg' && <ColorPickerModal isBackground={true} />}
      </div>

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />

      <button type="button" className="btn btn-sm btn-ghost" title="Align Left" onMouseDown={(e) => handleToolbarButton(e, 'justifyLeft')} style={{ width: 28, padding: '4px 8px' }}>L</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Align Center" onMouseDown={(e) => handleToolbarButton(e, 'justifyCenter')} style={{ width: 28, padding: '4px 8px' }}>C</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Align Right" onMouseDown={(e) => handleToolbarButton(e, 'justifyRight')} style={{ width: 28, padding: '4px 8px' }}>R</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Justify" onMouseDown={(e) => handleToolbarButton(e, 'justifyFull')} style={{ width: 28, padding: '4px 8px' }}>J</button>

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />

      <button type="button" className="btn btn-sm btn-ghost" title="Bullet List" onMouseDown={(e) => handleToolbarButton(e, 'insertUnorderedList')} style={{ padding: '4px 8px' }}>•</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Numbered List" onMouseDown={(e) => handleToolbarButton(e, 'insertOrderedList')} style={{ padding: '4px 8px' }}>1.</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Indent" onMouseDown={(e) => handleToolbarButton(e, 'indent')} style={{ padding: '4px 8px' }}>→|</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Outdent" onMouseDown={(e) => handleToolbarButton(e, 'outdent')} style={{ padding: '4px 8px' }}>|←</button>

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />

      <button type="button" className="btn btn-sm btn-ghost" title="Insert Link" onMouseDown={(e) => { e.preventDefault(); setShowLinkModal(true); }} style={{ padding: '4px 8px' }}>🔗</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Remove Link" onMouseDown={(e) => handleRemoveLink(e)} style={{ padding: '4px 8px' }}>✕</button>

      <button type="button" className="btn btn-sm btn-ghost" title="Insert Table" onMouseDown={(e) => { e.preventDefault(); setShowTableModal(true); }} style={{ padding: '4px 8px' }}>⊞</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Insert Image" onMouseDown={(e) => { e.preventDefault(); setShowImageModal(true); }} style={{ padding: '4px 8px' }}>🖼️</button>

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />

      <div style={{ position: 'relative', display: 'inline-block', zIndex: 9999 }}>
        <button type="button" className="btn btn-sm btn-ghost" title="Special Characters" onMouseDown={(e) => { e.preventDefault(); setShowSpecialChars(!showSpecialChars); }} style={{ padding: '4px 8px' }}>Ω</button>
        {showSpecialChars && <SpecialCharsModal />}
      </div>

      <button type="button" className="btn btn-sm btn-ghost" title="HTML Source" onMouseDown={(e) => { e.preventDefault(); setSourceCode(editorRef.current?.innerHTML || ''); setShowSourceCode(true); }} style={{ padding: '4px 8px' }}>{'</>'}</button>

      <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 4px' }} />

      <button type="button" className="btn btn-sm btn-ghost" title="Undo" onMouseDown={(e) => handleToolbarButton(e, 'undo')} style={{ padding: '4px 8px' }}>↩</button>
      <button type="button" className="btn btn-sm btn-ghost" title="Redo" onMouseDown={(e) => handleToolbarButton(e, 'redo')} style={{ padding: '4px 8px' }}>↪</button>

      <div style={{ flex: 1 }} />

      <button 
        type="button" 
        className={`btn btn-sm ${!isPlainMode ? 'btn-primary' : 'btn-ghost'}`}
        title="HTML Mode"
        onMouseDown={(e) => { e.preventDefault(); handlePlainToggle('html'); }}
        style={{ padding: '4px 12px' }}
      >
        HTML
      </button>
      <button 
        type="button" 
        className={`btn btn-sm ${isPlainMode ? 'btn-primary' : 'btn-ghost'}`}
        title="Plain Text Mode"
        onMouseDown={(e) => { e.preventDefault(); handlePlainToggle('plain'); }}
        style={{ padding: '4px 12px' }}
      >
        Plain
      </button>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '100%' }}>
      {renderToolbar()}
      
      {isPlainMode ? (
        <textarea
          className="form-control"
          defaultValue={plainTextRef.current !== undefined ? plainTextRef.current : editorRef.current?.innerText || ''}
          onChange={(e) => { plainTextRef.current = e.target.value; onChange(e.target.value); }}
          style={{ 
            minHeight: 300,
            padding: 15,
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            fontFamily: 'monospace',
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'vertical',
            width: '100%',
          }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="form-control"
          style={{ 
            minHeight: 300,
            padding: 15,
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            fontSize: 14,
            lineHeight: 1.6,
            outline: 'none',
            cursor: 'text',
            width: '100%',
          }}
          onInput={handleEditorInput}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          data-placeholder={placeholder}
        />
      )}

      {showLinkModal && <LinkModal />}
      {showTableModal && <TableModal />}
      {showImageModal && <ImageModal />}
      {showSourceCode && <SourceCodeModal />}
    </div>
  );
};

export default RichTextEditor;

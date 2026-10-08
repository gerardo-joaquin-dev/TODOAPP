import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Check, ChevronDown, CirclePlus, Filter, GripVertical, Hash, Minus, MoreHorizontal,
  Moon, Pencil, Plus, Search, Sun, Tag, Trash2, X
} from 'lucide-react'
import './styles.css'

const STORAGE_KEY = 'orbita-tasks-v1'

const initialData = {
  columns: [
    { id: 'ideas', title: 'Ideas', color: '#6c63ff' },
    { id: 'progress', title: 'En curso', color: '#ff8a4c' },
    { id: 'done', title: 'Listo', color: '#3ccf91' },
  ],
  tags: [
    { id: 'personal', name: 'personal', color: '#6c63ff' },
    { id: 'trabajo', name: 'trabajo', color: '#ff6b8a' },
    { id: 'rapido', name: 'rápido', color: '#f0a928' },
  ],
  tasks: [
    { id: 'welcome-1', title: 'Planea tu semana', columnId: 'ideas', tagIds: ['personal'], completed: false, createdAt: Date.now() - 2000 },
    { id: 'welcome-2', title: 'Preparar la presentación', columnId: 'progress', tagIds: ['trabajo'], completed: false, createdAt: Date.now() - 1000 },
    { id: 'welcome-3', title: 'Configurar mi tablero', columnId: 'done', tagIds: ['rapido'], completed: true, createdAt: Date.now() },
  ],
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : initialData
  } catch { return initialData }
}

function App() {
  const [data, setData] = useState(loadData)
  const [theme, setTheme] = useState(() => localStorage.getItem('orbita-theme') || 'light')
  const [draft, setDraft] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [tagMenu, setTagMenu] = useState(false)
  const [filter, setFilter] = useState('')
  const [selectedColumns, setSelectedColumns] = useState(() => data.columns.map(column => column.id))
  const [columnFilterOpen, setColumnFilterOpen] = useState(false)
  const [inlineTask, setInlineTask] = useState(null)
  const [menu, setMenu] = useState(null)
  const [modal, setModal] = useState(null)
  const [dragged, setDragged] = useState(null)
  const inputRef = useRef(null)
  const inlineInputRef = useRef(null)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }, [data])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('orbita-theme', theme)
  }, [theme])
  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool) return
    const lifecycle = new AbortController()
    const register = tool => Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {})
    register({
      name: 'list_tasks', title: 'Consultar tareas',
      description: 'Devuelve las tareas y su estado actual en el tablero.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({ tasks: data.tasks.map(task => ({
        id: task.id, title: task.title, completed: task.completed,
        column: data.columns.find(column => column.id === task.columnId)?.title,
        tags: task.tagIds.map(id => data.tags.find(tag => tag.id === id)?.name).filter(Boolean),
      })) }),
    })
    register({
      name: 'create_task', title: 'Crear tarea',
      description: 'Crea una tarea nueva en la primera columna del tablero.',
      inputSchema: {
        type: 'object', properties: { title: { type: 'string', minLength: 1 } },
        required: ['title'], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: input => {
        if (!input || typeof input.title !== 'string' || !input.title.trim()) throw new Error('El título es obligatorio')
        const task = { id: crypto.randomUUID(), title: input.title.trim(), columnId: data.columns[0].id, tagIds: [], completed: false, createdAt: Date.now() }
        setData(value => ({ ...value, tasks: [...value.tasks, task] }))
        return { id: task.id, title: task.title, created: true }
      },
    })
    return () => lifecycle.abort()
  }, [data])

  const tagQuery = useMemo(() => {
    const match = draft.match(/(?:^|\s)#([^\s#]*)$/)
    return match ? match[1].toLowerCase() : null
  }, [draft])
  const filteredTagOptions = data.tags.filter(t => !selectedTags.includes(t.id) && (tagQuery === null || t.name.toLowerCase().includes(tagQuery)))
  useEffect(() => { setTagMenu(tagQuery !== null) }, [tagQuery])

  const inlineTagQuery = useMemo(() => {
    if (!inlineTask) return null
    const match = inlineTask.draft.match(/(?:^|\s)#([^\s#]*)$/)
    return match ? match[1].toLowerCase() : null
  }, [inlineTask])
  const inlineTagOptions = data.tags.filter(tag =>
    inlineTask && !inlineTask.tagIds.includes(tag.id) &&
    (inlineTagQuery === null || tag.name.toLowerCase().includes(inlineTagQuery))
  )

  const visibleTasks = data.tasks.filter(t => {
    const tags = t.tagIds.map(id => data.tags.find(tag => tag.id === id)?.name || '').join(' ')
    return `${t.title} ${tags}`.toLowerCase().includes(filter.toLowerCase())
  })
  const visibleColumns = data.columns.filter(column => selectedColumns.includes(column.id))
  const allColumnsSelected = selectedColumns.length === data.columns.length
  const columnFilterLabel = allColumnsSelected
    ? 'Todas las columnas'
    : selectedColumns.length === 0
      ? 'Ninguna columna'
      : selectedColumns.length === 1
        ? data.columns.find(column => column.id === selectedColumns[0])?.title
        : `${selectedColumns.length} columnas`

  function pickTag(tag) {
    if (tagQuery !== null) setDraft(value => value.replace(/(?:^|\s)#[^\s#]*$/, value.startsWith('#') ? '' : ' '))
    setSelectedTags(value => [...new Set([...value, tag.id])])
    setTagMenu(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function addTask(e) {
    e?.preventDefault()
    const title = draft.trim().replace(/\s+/g, ' ')
    if (!title) return
    setData(value => ({ ...value, tasks: [...value.tasks, {
      id: crypto.randomUUID(), title, columnId: value.columns[0].id,
      tagIds: selectedTags, completed: false, createdAt: Date.now()
    }] }))
    setDraft(''); setSelectedTags([]); setTagMenu(false)
  }

  function pickInlineTag(tag) {
    setInlineTask(value => value ? ({
      ...value,
      draft: inlineTagQuery === null ? value.draft : value.draft.replace(/(?:^|\s)#[^\s#]*$/, value.draft.startsWith('#') ? '' : ' '),
      tagIds: [...new Set([...value.tagIds, tag.id])],
    }) : value)
    requestAnimationFrame(() => inlineInputRef.current?.focus())
  }

  function addInlineTask(event) {
    event.preventDefault()
    if (!inlineTask?.draft.trim()) return
    const task = {
      id: crypto.randomUUID(), title: inlineTask.draft.trim().replace(/\s+/g, ' '),
      columnId: inlineTask.columnId, tagIds: inlineTask.tagIds,
      completed: false, createdAt: Date.now(),
    }
    setData(value => ({ ...value, tasks: [...value.tasks, task] }))
    setInlineTask(null)
  }

  function toggleTask(id) {
    setData(value => ({ ...value, tasks: value.tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task) }))
  }

  function deleteTask(id) {
    setData(value => ({ ...value, tasks: value.tasks.filter(task => task.id !== id) }))
    setMenu(null)
  }

  function moveTask(taskId, columnId) {
    setData(value => ({ ...value, tasks: value.tasks.map(task => task.id === taskId ? { ...task, columnId, completed: columnId === 'done' ? true : task.completed } : task) }))
    setDragged(null)
  }

  function saveColumn(payload) {
    if (modal?.type === 'editColumn') {
      setData(value => ({ ...value, columns: value.columns.map(c => c.id === modal.column.id ? { ...c, ...payload } : c) }))
    } else {
      const id = crypto.randomUUID()
      setData(value => ({ ...value, columns: [...value.columns, { id, ...payload }] }))
      setSelectedColumns(value => [...value, id])
    }
    setModal(null)
  }

  function deleteColumn(columnId) {
    if (data.columns.length <= 1) return
    const fallback = data.columns.find(c => c.id !== columnId).id
    setData(value => ({
      ...value,
      columns: value.columns.filter(c => c.id !== columnId),
      tasks: value.tasks.map(t => t.columnId === columnId ? { ...t, columnId: fallback } : t)
    }))
    setSelectedColumns(value => value.filter(id => id !== columnId))
    setMenu(null)
  }

  function createTag(payload) {
    const tag = { id: crypto.randomUUID(), ...payload }
    setData(value => ({ ...value, tags: [...value.tags, tag] }))
    if (modal?.selectAfter) setSelectedTags(value => [...value, tag.id])
    setModal(null)
  }

  const openNewTag = () => setModal({ type: 'tag', selectAfter: true, seed: tagQuery || '' })

  return (
    <div className="app-shell" onClick={() => { if (menu) setMenu(null); if (columnFilterOpen) setColumnFilterOpen(false) }}>
      <header>
        <div className="brand"><span className="brand-mark"><span /></span><strong>todolume</strong></div>
        <div className="header-actions">
          <label className="search"><Search size={17}/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar tareas" aria-label="Buscar tareas"/></label>
          <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Cambiar tema">
            {theme === 'light' ? <Moon size={19}/> : <Sun size={19}/>}<span className="desktop-label">Tema</span>
          </button>
        </div>
      </header>

      <main>
        <section className="intro">
          <div><p className="eyebrow">MI ESPACIO</p><h1>Mis tareas</h1><p className="summary">{data.tasks.filter(t => !t.completed).length} pendientes · {data.tasks.filter(t => t.completed).length} completadas</p></div>
          <div className="board-actions">
            <div className="column-filter" onClick={event => event.stopPropagation()}>
              <button className="column-filter-button" onClick={() => setColumnFilterOpen(value => !value)} aria-haspopup="listbox" aria-expanded={columnFilterOpen}>
                <Filter size={16}/><span>{columnFilterLabel}</span><ChevronDown className={columnFilterOpen ? 'rotated' : ''} size={15}/>
              </button>
              {columnFilterOpen && <div className="column-filter-menu" role="listbox">
                <button className={allColumnsSelected ? 'active' : ''} onClick={() => setSelectedColumns(allColumnsSelected ? [] : data.columns.map(column => column.id))}><span className={`filter-check ${selectedColumns.length ? 'checked' : ''}`}>{allColumnsSelected ? <Check size={13}/> : selectedColumns.length > 0 ? <Minus size={13}/> : null}</span><span>Todas las columnas</span></button>
                <div className="filter-separator"/>
                {data.columns.map(column => { const selected = selectedColumns.includes(column.id); return <button key={column.id} className={selected ? 'active' : ''} onClick={() => setSelectedColumns(value => selected ? value.filter(id => id !== column.id) : [...value, column.id])}><span className="filter-dot" style={{background:column.color}}/><span>{column.title}</span><span className={`filter-check ${selected ? 'checked' : ''}`}>{selected && <Check size={13}/>}</span></button> })}
                <p className="filter-count">{selectedColumns.length} de {data.columns.length} visibles</p>
              </div>}
            </div>
            <button className="secondary-button manage-tags" onClick={() => setModal({ type: 'tag', seed: '' })}><Tag size={17}/> Administrar tags</button>
          </div>
        </section>

        <form className="quick-add" onSubmit={addTask}>
          <div className="add-icon"><Plus size={21}/></div>
          <div className="input-wrap">
            <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} onFocus={() => tagQuery !== null && setTagMenu(true)} placeholder="¿Qué tienes que hacer? Escribe # para añadir un tag" aria-label="Nueva tarea" />
            {selectedTags.length > 0 && <div className="selected-tags">
              {selectedTags.map(id => { const tag = data.tags.find(t => t.id === id); return tag && <button type="button" key={id} style={{'--tag': tag.color}} onClick={() => setSelectedTags(v => v.filter(x => x !== id))}>#{tag.name}<X size={12}/></button> })}
            </div>}
            {tagMenu && <div className="tag-popover">
              <p>Elegir un tag</p>
              {filteredTagOptions.map(tag => <button type="button" key={tag.id} onClick={() => pickTag(tag)}><span style={{background: tag.color}}/>#{tag.name}</button>)}
              <button type="button" className="create-tag" onClick={openNewTag}><Plus size={15}/> Crear {tagQuery ? `#${tagQuery}` : 'tag'}</button>
            </div>}
          </div>
          <button className="add-button" disabled={!draft.trim()}><span>Añadir tarea</span><kbd>↵</kbd></button>
        </form>

        {filter && <div className="filter-note">Resultados para “{filter}” <button onClick={() => setFilter('')}>Limpiar</button></div>}

        <section className={`board ${visibleColumns.length === 1 ? 'board-filtered' : ''} ${visibleColumns.length === 2 ? 'board-two' : ''} ${visibleColumns.length === 0 ? 'board-empty-filter' : ''}`} aria-label="Tablero de tareas">
          {visibleColumns.map(column => {
            const tasks = visibleTasks.filter(t => t.columnId === column.id)
            return <div className={`column ${dragged ? 'drag-active' : ''}`} key={column.id} onDragOver={e => e.preventDefault()} onDrop={() => dragged && moveTask(dragged, column.id)}>
              <div className="column-head">
                <div><span className="status-dot" style={{background: column.color}}/><h2>{column.title}</h2><span className="count">{tasks.length}</span></div>
                <div className="menu-anchor">
                  <button className="plain-icon" onClick={e => { e.stopPropagation(); setMenu(menu === column.id ? null : column.id) }} aria-label={`Opciones de ${column.title}`}><MoreHorizontal size={19}/></button>
                  {menu === column.id && <div className="context-menu" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setModal({type:'editColumn', column}); setMenu(null) }}><Pencil size={15}/> Editar columna</button>
                    {data.columns.length > 1 && <button className="danger" onClick={() => deleteColumn(column.id)}><Trash2 size={15}/> Eliminar columna</button>}
                  </div>}
                </div>
              </div>
              <div className="task-list">
                {tasks.map(task => <article className={`task-card ${task.completed ? 'completed' : ''}`} key={task.id} draggable onDragStart={() => setDragged(task.id)} onDragEnd={() => setDragged(null)}>
                  <div className="drag-handle"><GripVertical size={16}/></div>
                  <button className="check" onClick={() => toggleTask(task.id)} aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}>{task.completed && <Check size={14}/>}</button>
                  <div className="task-content"><p>{task.title}</p>{task.tagIds.length > 0 && <div className="card-tags">{task.tagIds.map(id => { const tag = data.tags.find(t => t.id === id); return tag && <span key={id} style={{'--tag': tag.color}}>#{tag.name}</span> })}</div>}</div>
                  <button className="delete-task" onClick={() => deleteTask(task.id)} aria-label="Eliminar tarea"><X size={16}/></button>
                </article>)}
                {tasks.length === 0 && <div className="empty-state"><span>○</span><p>{filter ? 'Sin coincidencias' : 'Suelta una tarea aquí'}</p></div>}
              </div>
              {inlineTask?.columnId === column.id ? <form className="inline-task-editor" onSubmit={addInlineTask} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInlineTask(null) }}>
                <div className="inline-input-row"><input ref={inlineInputRef} autoFocus value={inlineTask.draft} onChange={event => setInlineTask(value => ({...value, draft:event.target.value}))} onKeyDown={event => event.key === 'Escape' && setInlineTask(null)} placeholder="Nueva tarea... usa # para tags" aria-label={`Nueva tarea en ${column.title}`}/><button disabled={!inlineTask.draft.trim()} aria-label="Guardar tarea"><Check size={16}/></button></div>
                {inlineTask.tagIds.length > 0 && <div className="selected-tags inline-selected-tags">{inlineTask.tagIds.map(id => { const tag = data.tags.find(item => item.id === id); return tag && <button type="button" key={id} style={{'--tag':tag.color}} onClick={() => setInlineTask(value => ({...value, tagIds:value.tagIds.filter(tagId => tagId !== id)}))}>#{tag.name}<X size={12}/></button> })}</div>}
                {inlineTagQuery !== null && <div className="tag-popover inline-tag-popover"><p>Elegir un tag</p>{inlineTagOptions.length ? inlineTagOptions.map(tag => <button type="button" key={tag.id} onClick={() => pickInlineTag(tag)}><span style={{background:tag.color}}/>#{tag.name}</button>) : <span className="no-tags">No hay tags disponibles</span>}</div>}
              </form> : <button className="column-add" onClick={() => setInlineTask({columnId:column.id, draft:'', tagIds:[]})}><CirclePlus size={16}/> Añadir tarea</button>}
            </div>
          })}
          <button className="new-column" onClick={() => setModal({type:'column'})}><Plus size={18}/> Nueva columna</button>
        </section>
      </main>
      <footer><span>Todo se guarda en este dispositivo</span><span className="save-dot"/> Guardado automáticamente</footer>
      {modal && <Modal modal={modal} tags={data.tags} onClose={() => setModal(null)} onSaveColumn={saveColumn} onSaveTag={createTag} onDeleteTag={id => setData(v => ({...v, tags:v.tags.filter(t => t.id !== id), tasks:v.tasks.map(task => ({...task, tagIds:task.tagIds.filter(x => x !== id)}))}))}/>} 
    </div>
  )
}

function Modal({ modal, tags, onClose, onSaveColumn, onSaveTag, onDeleteTag }) {
  const isColumn = modal.type === 'column' || modal.type === 'editColumn'
  const [name, setName] = useState(isColumn ? modal.column?.title || '' : modal.seed || '')
  const colors = ['#6c63ff','#ff6b8a','#ff8a4c','#f0b429','#3ccf91','#18a6b7']
  const [color, setColor] = useState(isColumn ? modal.column?.color || colors[0] : colors[1])
  function submit(e) { e.preventDefault(); if (!name.trim()) return; isColumn ? onSaveColumn({title:name.trim(), color}) : onSaveTag({name:name.trim().replace(/^#/, ''), color}) }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-head"><div><p className="eyebrow">PERSONALIZAR</p><h2>{isColumn ? (modal.type === 'editColumn' ? 'Editar columna' : 'Nueva columna') : 'Crear tag'}</h2></div><button className="plain-icon" onClick={onClose}><X size={20}/></button></div>
      {!isColumn && modal.type === 'tag' && tags.length > 0 && <div className="existing-tags">{tags.map(tag => <span key={tag.id} style={{'--tag': tag.color}}>#{tag.name}<button onClick={() => onDeleteTag(tag.id)} aria-label={`Eliminar ${tag.name}`}><X size={12}/></button></span>)}</div>}
      <form onSubmit={submit}>
        <label>{isColumn ? 'Nombre de la columna' : 'Nombre del tag'}<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={isColumn ? 'Por revisar' : 'importante'}/></label>
        <fieldset><legend>Color</legend><div className="colors">{colors.map(c => <button type="button" key={c} className={color === c ? 'selected' : ''} style={{background:c}} onClick={() => setColor(c)} aria-label={`Color ${c}`}>{color === c && <Check size={15}/>}</button>)}<label className="color-picker"><input type="color" value={color} onChange={event => setColor(event.target.value)}/><span style={{background:color}}/><span>Otro color</span></label></div></fieldset>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!name.trim()}>Guardar</button></div>
      </form>
    </div>
  </div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)

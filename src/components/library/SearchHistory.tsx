'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface SearchItem {
  id: string
  question_text: string
  answer_text: string
  is_archived: boolean
  project_id: string | null
  created_at: string
}

interface Project {
  id: string
  name: string
  color: string
}

interface SearchHistoryProps {
  userId: string
  onSelectSearch: (item: SearchItem) => void
}

export default function SearchHistory({ userId, onSelectSearch }: SearchHistoryProps) {
  const [history, setHistory] = useState<SearchItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [editingItem, setEditingItem] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [userId, selectedProject])

  const fetchData = async () => {
    // جلب المشاريع
    const { data: projectsData } = await supabase
      .from('kb_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (projectsData) setProjects(projectsData)

    // جلب السجل
    let query = supabase
      .from('kb_search_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (selectedProject) {
      query = query.eq('project_id', selectedProject)
    }

    const { data } = await query
    if (data) setHistory(data)
    setIsLoading(false)
  }

  const createProject = async () => {
    if (!newProjectName.trim()) return

    await supabase.from('kb_projects').insert({
      user_id: userId,
      name: newProjectName.trim(),
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    })

    setNewProjectName('')
    setShowNewProject(false)
    fetchData()
  }

  const deleteProject = async (projectId: string) => {
    if (!confirm('حذف المشروع؟ سيبقى السجل بدون مشروع')) return
    await supabase.from('kb_projects').delete().eq('id', projectId)
    if (selectedProject === projectId) setSelectedProject(null)
    fetchData()
  }

  const moveToProject = async (itemId: string, projectId: string | null) => {
    await supabase
      .from('kb_search_history')
      .update({ project_id: projectId })
      .eq('id', itemId)
    
    setEditingItem(null)
    fetchData()
  }

  const toggleArchive = async (id: string, currentStatus: boolean) => {
    await supabase
      .from('kb_search_history')
      .update({ is_archived: !currentStatus })
      .eq('id', id)
    fetchData()
  }

  const deleteItem = async (id: string) => {
    await supabase.from('kb_search_history').delete().eq('id', id)
    fetchData()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('تم النسخ!')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'اليوم'
    if (days === 1) return 'أمس'
    if (days < 7) return `منذ ${days} أيام`
    return date.toLocaleDateString('ar-SA')
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const groupedHistory = history.reduce((groups: { [key: string]: SearchItem[] }, item) => {
    const date = formatDate(item.created_at)
    if (!groups[date]) groups[date] = []
    groups[date].push(item)
    return groups
  }, {})

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <span>📂</span>
          <span>سجل البحث</span>
        </h3>
      </div>

      {/* المشاريع */}
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">المشاريع</span>
          <button
            onClick={() => setShowNewProject(!showNewProject)}
            className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded"
          >
            + جديد
          </button>
        </div>

        {showNewProject && (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="اسم المشروع"
              className="flex-1 bg-slate-700 text-white text-sm px-2 py-1 rounded border-0 focus:ring-1 focus:ring-primary-500"
              onKeyPress={(e) => e.key === 'Enter' && createProject()}
            />
            <button
              onClick={createProject}
              className="bg-primary-600 hover:bg-primary-700 px-2 py-1 rounded text-xs"
            >
              حفظ
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedProject(null)}
            className={`text-xs px-2 py-1 rounded transition-all ${
              !selectedProject 
                ? 'bg-primary-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            الكل
          </button>
          {projects.map((project) => (
            <div key={project.id} className="relative group">
              <button
                onClick={() => setSelectedProject(project.id)}
                className={`text-xs px-2 py-1 rounded transition-all ${
                  selectedProject === project.id 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                style={{ borderRight: `3px solid ${project.color}` }}
              >
                {project.name}
              </button>
              <button
                onClick={() => deleteProject(project.id)}
                className="absolute -top-1 -left-1 bg-red-500 text-white w-4 h-4 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* السجل */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="p-4 text-center text-slate-400">
            <span className="text-3xl block mb-2">📭</span>
            <p className="text-sm">لا يوجد سجل بحث</p>
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(groupedHistory).map(([date, items]) => (
              <div key={date} className="mb-4">
                <p className="text-xs text-slate-500 px-2 mb-2 flex items-center gap-1">
                  <span>🕐</span>
                  <span>{date}</span>
                </p>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group relative p-3 rounded-lg hover:bg-slate-700/50 cursor-pointer mb-1 transition-all border-r-2 border-transparent hover:border-primary-500"
                    onClick={() => onSelectSearch(item)}
                  >
                    <p className="text-sm text-slate-200 line-clamp-2 pl-16">
                      {item.question_text}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>{formatTime(item.created_at)}</span>
                      {item.is_archived && <span>📌</span>}
                    </p>
                    
                    {/* أزرار التحكم */}
                    <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(item.question_text + '\n\n' + item.answer_text) }}
                        className="p-1 rounded hover:bg-slate-600 text-xs"
                        title="نسخ"
                      >
                        📋
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingItem(editingItem === item.id ? null : item.id) }}
                        className="p-1 rounded hover:bg-slate-600 text-xs"
                        title="نقل لمشروع"
                      >
                        📁
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleArchive(item.id, item.is_archived) }}
                        className="p-1 rounded hover:bg-slate-600 text-xs"
                        title={item.is_archived ? 'إلغاء الحفظ' : 'حفظ'}
                      >
                        {item.is_archived ? '📌' : '📍'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}
                        className="p-1 rounded hover:bg-red-600 text-xs"
                        title="حذف"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* قائمة نقل لمشروع */}
                    {editingItem === item.id && (
                      <div className="absolute left-2 top-10 bg-slate-800 border border-slate-600 rounded-lg p-2 z-10 shadow-xl">
                        <p className="text-xs text-slate-400 mb-2">نقل إلى:</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveToProject(item.id, null) }}
                          className="block w-full text-right text-xs px-2 py-1 hover:bg-slate-700 rounded"
                        >
                          بدون مشروع
                        </button>
                        {projects.map((p) => (
                          <button
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); moveToProject(item.id, p.id) }}
                            className="block w-full text-right text-xs px-2 py-1 hover:bg-slate-700 rounded"
                            style={{ borderRight: `2px solid ${p.color}` }}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700 text-xs text-slate-500 text-center">
        ⏱️ يُحذف السجل غير المحفوظ بعد 30 يوم
      </div>
    </div>
  )
}

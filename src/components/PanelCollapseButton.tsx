type PanelCollapseButtonProps = {
  collapsed: boolean
  onClick: () => void
  axis?: 'horizontal' | 'vertical'
}

const ChevronIcon = ({ collapsed, axis = 'horizontal' }: { collapsed: boolean; axis?: 'horizontal' | 'vertical' }) => {
  const className = [
    'panel-collapse-icon',
    collapsed ? 'collapsed' : '',
    axis === 'vertical' ? 'vertical' : 'horizontal',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <svg className={className} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.25 4.5 6 8l3.75-3.5" />
    </svg>
  )
}

export const PanelCollapseButton = ({ collapsed, onClick, axis = 'horizontal' }: PanelCollapseButtonProps) => (
  <button
    type="button"
    className="mini-btn panel-collapse-btn icon-btn"
    onClick={onClick}
    aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
    title={collapsed ? 'Expand' : 'Collapse'}
  >
    <ChevronIcon collapsed={collapsed} axis={axis} />
  </button>
)

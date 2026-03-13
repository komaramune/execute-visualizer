type MacroArgsPanelProps = {
  value: string
  onChange: (value: string) => void
}

export const MacroArgsPanel = ({ value, onChange }: MacroArgsPanelProps) => (
  <div className="macro-args-panel side-panel">
    <div className="entity-head">
      <h2>Macro Args</h2>
    </div>
    <div className="macro-args-body entity-list">
      <textarea
        className="macro-args-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder='{hoge:"fuga",piyo:1}'
        spellCheck={false}
      />
    </div>
  </div>
)

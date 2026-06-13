'use client'

import { useState } from 'react'
import { Key, Save, Eye, EyeOff, CheckCircle, ExternalLink, Info } from 'lucide-react'
import { useAppStore } from '@/store'

function KeyInput({
  label, hint, link, linkText, placeholder, value, onChange, onSave, saved,
}: {
  label: string; hint: string; link: string; linkText: string; placeholder: string
  value: string; onChange: (v: string) => void; onSave: () => void; saved: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="settings-section">
      <h3 className="settings-title"><Key size={14} /> {label}</h3>
      <p className="settings-desc">
        {hint}{' '}
        <a href={link} target="_blank" rel="noopener noreferrer">
          {linkText} <ExternalLink size={11} />
        </a>
      </p>
      <div className="settings-input-row">
        <input
          type={show ? 'text' : 'password'}
          className="settings-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="settings-icon-btn" onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <button className="settings-save" onClick={onSave}>
        {saved ? <><CheckCircle size={13} /> Saved</> : <><Save size={13} /> Save</>}
      </button>
    </div>
  )
}

export default function SettingsPanel() {
  const { veniceApiKey, setVeniceApiKey } = useAppStore()
  const [vKey, setVKey] = useState(veniceApiKey)
  const [vSaved, setVSaved] = useState(false)

  function saveVenice() { setVeniceApiKey(vKey); setVSaved(true); setTimeout(() => setVSaved(false), 2000) }

  return (
    <div className="settings-panel">
      <KeyInput
        label="Venice AI"
        hint="Privacy-first on-device inference. Get a key at"
        link="https://venice.ai/settings/api"
        linkText="venice.ai"
        placeholder="vn-…"
        value={vKey}
        onChange={setVKey}
        onSave={saveVenice}
        saved={vSaved}
      />

      <div className="settings-section">
        <div className="settings-info-box">
          <Info size={13} />
          <span>No key? The app runs in <strong>Demo Mode</strong> with built-in pattern matching — perfect for demos and testing.</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">Stack</h3>
        <div className="settings-about">
          {[
            ['Smart Accounts', 'MetaMask Delegation Toolkit'],
            ['Permissions', 'ERC-7715 wallet_grantPermissions'],
            ['Delegation', 'ERC-7710 via @metamask/delegation-toolkit'],
            ['Gas Relayer', '1Shot Permissionless Relayer'],
            ['AI', 'Venice AI — Llama 3.3 70B (privacy-first)'],
            ['Agent arch', 'A2A pipeline (Parser → Validator → Planner)'],
            ['Network', 'Sepolia testnet'],
          ].map(([k, v]) => (
            <div key={k} className="settings-about-item">
              <span className="about-label">{k}</span>
              <span className="about-val">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

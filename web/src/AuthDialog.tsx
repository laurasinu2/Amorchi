import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, X } from 'lucide-react';
import { accountRequest } from './account';
import './auth.css';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

export function AuthDialog({ onClose, onLogin }: {
  onClose: () => void;
  onLogin: (credentials: { email: string; password: string; remember: boolean }) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape); };
  }, [onClose]);

  function change(next: Mode) {
    setMode(next); setError(''); setNotice(''); setPassword(''); setRepeat(''); setCode('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'login') {
        await onLogin({ email, password, remember });
        onClose();
      } else if (mode === 'register') {
        if (password !== repeat) throw new Error('Las contraseñas no coinciden.');
        await accountRequest('register', { email, display_name: name.trim(), password, repeat_password: repeat });
        change('verify');
        setNotice('Te hemos enviado un código de seis dígitos.');
      } else if (mode === 'verify') {
        const response = await accountRequest('verify', { email, code });
        change('login'); setNotice(response.message);
      } else if (mode === 'forgot') {
        const response = await accountRequest('forgot', { email });
        change('reset'); setNotice(response.message);
      } else {
        if (password !== repeat) throw new Error('Las contraseñas no coinciden.');
        const response = await accountRequest('reset', { email, code, password, repeat_password: repeat });
        change('login'); setNotice(response.message);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Ha ocurrido un error.'); }
    finally { setBusy(false); }
  }

  const titles: Record<Mode, string> = {
    login: 'Iniciar sesión', register: 'Crear cuenta', verify: 'Verificar correo',
    forgot: 'Recuperar contraseña', reset: 'Nueva contraseña'
  };
  const subtitles: Record<Mode, string> = {
    login: 'Accede a tu cuenta para ver tus fotografías, viajes y recuerdos.',
    register: 'Crea tu espacio privado para guardar tus recuerdos.',
    verify: 'Introduce el código que hemos enviado a tu correo electrónico.',
    forgot: 'Te enviaremos un código para recuperar el acceso.',
    reset: 'Introduce la nueva contraseña y el código recibido por correo.'
  };

  return <div className="auth-overlay" role="presentation" onMouseDown={e => { if(e.target === e.currentTarget) onClose(); }}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button type="button" className="auth-close" aria-label="Cerrar" onClick={onClose}><X size={20}/></button>
      <img className="auth-logo" src="/brand/memrly-horizontal.png" alt="Memrly"
        onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/brand/memrly-horizontal.svg'; }} />
      <h1 id="auth-title">{titles[mode]}</h1>
      <p className="auth-subtitle">{subtitles[mode]}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && <label className="auth-field"><span className="sr-only">Nombre</span>
          <input type="text" autoComplete="name" placeholder="Nombre" required maxLength={100} value={name} onChange={e=>setName(e.target.value)} /></label>}
        <label className="auth-field"><Mail size={19}/><span className="sr-only">Correo electrónico</span>
          <input type="email" autoComplete="email" placeholder="Correo electrónico" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
        {(['login','register','reset'] as Mode[]).includes(mode) && <>
          <label className="auth-field"><LockKeyhole size={19}/><span className="sr-only">{mode === 'reset'?'Nueva contraseña':'Contraseña'}</span>
            <input type={visible ? 'text' : 'password'} autoComplete={mode === 'login'?'current-password':'new-password'}
              placeholder={mode === 'reset'?'Nueva contraseña':'Contraseña'} required minLength={mode === 'login'?undefined:12} value={password} onChange={e=>setPassword(e.target.value)}/>
            <button className="auth-eye" type="button" aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button>
          </label>
          {mode !== 'login' && <label className="auth-field"><LockKeyhole size={19}/><span className="sr-only">Repetir contraseña</span>
            <input type={visible?'text':'password'} autoComplete="new-password" placeholder="Repetir contraseña" minLength={12} required value={repeat} onChange={e=>setRepeat(e.target.value)}/></label>}
        </>}
        {(mode === 'verify' || mode === 'reset') && <label className="auth-field"><LockKeyhole size={19}/><span className="sr-only">Código de correo</span>
          <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="Código de 6 dígitos" required value={code} onChange={e=>setCode(e.target.value)}/></label>}
        {mode === 'login' && <div className="auth-options">
          <label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Recordarme</label>
          <button type="button" className="auth-link" onClick={()=>change('forgot')}>¿Has olvidado tu contraseña?</button>
        </div>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-primary" type="submit" disabled={busy}>
          {busy?'Procesando…':mode==='login'?'Entrar':mode==='register'?'Crear cuenta':mode==='verify'?'Verificar correo':mode==='forgot'?'Enviar código':'Cambiar contraseña'}
        </button>
        {mode === 'login' && <button type="button" className="auth-secondary" onClick={()=>change('register')}>Crear cuenta</button>}
        {mode !== 'login' && <button type="button" className="auth-link auth-back" onClick={()=>change('login')}>Volver a iniciar sesión</button>}
        {mode === 'verify' && <button type="button" className="auth-link" disabled={busy} onClick={async()=>{
          try { setNotice((await accountRequest('resend',{email})).message); setError(''); }
          catch(err) { setError(err instanceof Error?err.message:'No se pudo reenviar el código.'); }
        }}>Reenviar código</button>}
      </form>
      <p className="auth-footer"><LockKeyhole size={15}/> Tus recuerdos, seguros y siempre contigo.</p>
    </section>
  </div>;
}

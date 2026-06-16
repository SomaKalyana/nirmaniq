import React, { useState } from 'react';
import styles from './Auth.module.css';

const API = async (path, body) => {
    const r = await fetch(`/api/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || `Error ${r.status}`);
    return data;
};

export default function Login({ onLogin, onRegister, onBack }) {
    const [step,       setStep]       = useState('credentials'); // credentials | otp
    const [identifier, setIdentifier] = useState('');
    const [password,   setPassword]   = useState('');
    const [otp,        setOtp]        = useState('');
    const [devOtp,     setDevOtp]     = useState('');
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState('');
    const [showPass,   setShowPass]   = useState(false);
    const [otpTimer,   setOtpTimer]   = useState(0);
    const [resending,  setResending]  = useState(false);

    // OTP countdown
    React.useEffect(() => {
        if (otpTimer <= 0) return;
        const t = setTimeout(() => setOtpTimer(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [otpTimer]);

    const handleCredentials = async (e) => {
        e.preventDefault();
        if (!identifier.trim()) { setError('Enter your email or mobile number'); return; }
        if (!password)          { setError('Enter your password'); return; }
        setError(''); setLoading(true);
        try {
            const res = await API('login', { identifier: identifier.trim(), password });
            if (res.step === 'otp_required') {
                setDevOtp(res.devOtp || '');
                setStep('otp');
                setOtpTimer(300);
            } else if (res.step === 'authenticated') {
                localStorage.setItem('nirmaniq_token', res.token);
                onLogin(res.user);
            }
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    };

    const handleOtp = async (e) => {
        e.preventDefault();
        if (otp.length < 6) { setError('Enter the 6-digit OTP'); return; }
        setError(''); setLoading(true);
        try {
            const res = await API('login', { identifier: identifier.trim(), password, otp: otp.trim() });
            if (res.step === 'authenticated') {
                localStorage.setItem('nirmaniq_token', res.token);
                onLogin(res.user);
            }
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    };

    const resendOtp = async () => {
        setResending(true); setError('');
        try {
            const res = await API('send-otp', { identifier: identifier.trim(), purpose: 'login' });
            setDevOtp(res.devOtp || '');
            setOtpTimer(300);
        } catch (err) { setError(err.message); }
        finally { setResending(false); }
    };

    const channelHint = identifier.includes('@') ? 'email' : 'SMS';
    const masked = identifier.includes('@')
        ? identifier.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 4)) + c)
        : identifier.replace(/(\d{3})(\d*)(\d{3})/, (_, a, b, c) => a + '*'.repeat(b.length) + c);

    return (
        <div className={styles.authWrap}>
            <div className={styles.authCard}>
                {/* Logo */}
                <div className={styles.authBrand}>
                    <div className={styles.authBrandIcon}>📐</div>
                    <div className={styles.authBrandName}>NirmanIQ</div>
                    <div className={styles.authBrandTag}>Construction Intelligence</div>
                </div>

                {step === 'credentials' && (
                    <>
                        <h2 className={styles.authTitle}>Sign in</h2>
                        <p className={styles.authSub}>Use your email or mobile number</p>

                        <form onSubmit={handleCredentials} className={styles.authForm}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Email or mobile number</label>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    placeholder="you@email.com or 98765 43210"
                                    autoComplete="username"
                                    autoFocus
                                />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Password</label>
                                <div className={styles.passWrap}>
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                    />
                                    <button type="button" className={styles.passToggle}
                                        onClick={() => setShowPass(s => !s)}>
                                        {showPass ? '🙈' : '👁'}
                                    </button>
                                </div>
                            </div>
                            {error && <div className={styles.authError}>⚠ {error}</div>}
                            <button className={styles.authBtn} type="submit" disabled={loading}>
                                {loading ? <span className={styles.spinner}/> : 'Continue →'}
                            </button>
                        </form>

                        <div className={styles.authDivider}><span>or</span></div>
                        <div className={styles.authFooter}>
                            <span>New to NirmanIQ?</span>
                            <button className={styles.authLink} onClick={onRegister}>Create account</button>
                        </div>
                    </>
                )}

                {step === 'otp' && (
                    <>
                        <h2 className={styles.authTitle}>Verify it's you</h2>
                        <p className={styles.authSub}>
                            We sent a 6-digit OTP to your {channelHint}
                            {masked && <> <strong>{masked}</strong></>}
                        </p>

                        {devOtp && (
                            <div className={styles.devOtpBanner}>
                                <div className={styles.devOtpLabel}>🛠 DEV MODE — OTP:</div>
                                <div className={styles.devOtpCode}>{devOtp}</div>
                                <div className={styles.devOtpNote}>In production this would be sent via {channelHint}</div>
                            </div>
                        )}

                        <form onSubmit={handleOtp} className={styles.authForm}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>6-digit OTP</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0,6))}
                                    placeholder="000000"
                                    autoFocus
                                    className={styles.otpInput}
                                />
                                {otpTimer > 0 && (
                                    <div className={styles.otpTimer}>
                                        Expires in {Math.floor(otpTimer/60)}:{String(otpTimer%60).padStart(2,'0')}
                                    </div>
                                )}
                            </div>
                            {error && <div className={styles.authError}>⚠ {error}</div>}
                            <button className={styles.authBtn} type="submit" disabled={loading || otp.length < 6}>
                                {loading ? <span className={styles.spinner}/> : 'Verify & sign in →'}
                            </button>
                        </form>

                        <div className={styles.authFooter}>
                            <span>Didn't receive it?</span>
                            <button className={styles.authLink} onClick={resendOtp}
                                disabled={resending || otpTimer > 270}>
                                {resending ? 'Sending…' : 'Resend OTP'}
                            </button>
                        </div>
                        <button className={styles.authBack} onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}>
                            ← Back to sign in
                        </button>
                    </>
                )}

                {onBack && (
                    <button className={styles.authBackTop} onClick={onBack}>← Back to home</button>
                )}
            </div>
        </div>
    );
}

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

const STEPS = ['details', 'password', 'verify'];
const STEP_LABELS = ['Your details', 'Set password', 'Verify'];

export default function RegisterCustomer({ onRegistered, onCancel }) {
    const [step,      setStep]      = useState(0);
    const [name,      setName]      = useState('');
    const [email,     setEmail]     = useState('');
    const [phone,     setPhone]     = useState('');
    const [password,  setPassword]  = useState('');
    const [confirm,   setConfirm]   = useState('');
    const [otp,       setOtp]       = useState('');
    const [devOtp,    setDevOtp]    = useState('');
    const [userId,    setUserId]    = useState('');
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState('');
    const [showPass,  setShowPass]  = useState(false);
    const [otpTimer,  setOtpTimer]  = useState(0);

    React.useEffect(() => {
        if (otpTimer <= 0) return;
        const t = setTimeout(() => setOtpTimer(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [otpTimer]);

    const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const validatePhone = (p) => /^[6-9]\d{9}$/.test(p.replace(/[\s+\-()]/g, ''));

    const handleDetails = (e) => {
        e.preventDefault();
        if (!name.trim())                              { setError('Full name is required'); return; }
        if (!email && !phone)                          { setError('Email or mobile number is required'); return; }
        if (email && !validateEmail(email))            { setError('Enter a valid email address'); return; }
        if (phone && !validatePhone(phone))            { setError('Enter a valid 10-digit mobile number'); return; }
        setError('');
        setStep(1);
    };

    const handlePassword = (e) => {
        e.preventDefault();
        if (password.length < 8)                      { setError('Password must be at least 8 characters'); return; }
        if (!/[A-Z]/.test(password))                  { setError('Password must include an uppercase letter'); return; }
        if (!/[0-9]/.test(password))                  { setError('Password must include a number'); return; }
        if (password !== confirm)                     { setError('Passwords do not match'); return; }
        setError('');
        submitRegistration();
    };

    const submitRegistration = async () => {
        setLoading(true); setError('');
        try {
            const res = await API('register', {
                name: name.trim(), email: email.trim().toLowerCase(),
                phone: phone.trim(), password,
            });
            setUserId(res.userId);
            setDevOtp(res.devOtp || '');
            setOtpTimer(300);
            setStep(2);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        if (otp.length < 6) { setError('Enter the 6-digit OTP'); return; }
        setError(''); setLoading(true);
        const identifier = email || phone;
        try {
            await API('verify-otp', { identifier, otp: otp.trim(), purpose: 'register' });
            // Auto-login after verification
            const loginRes = await API('login', { identifier, password, otp: otp.trim() });
            if (loginRes.step === 'authenticated') {
                localStorage.setItem('nirmaniq_token', loginRes.token);
                onRegistered && onRegistered(loginRes.user);
            } else {
                // MFA asked again — just confirm and go to login
                onRegistered && onRegistered({ id: userId, name, email, phone });
            }
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const resendOtp = async () => {
        setLoading(true);
        try {
            const res = await API('send-otp', { identifier: email || phone, purpose: 'register' });
            setDevOtp(res.devOtp || '');
            setOtpTimer(300);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    const pwStrength = () => {
        let s = 0;
        if (password.length >= 8)         s++;
        if (/[A-Z]/.test(password))       s++;
        if (/[0-9]/.test(password))       s++;
        if (/[^A-Za-z0-9]/.test(password))s++;
        return s; // 0-4
    };
    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const strengthColor = ['', '#F85149', '#D29922', '#3FB950', '#2DD4A0'];
    const ps = pwStrength();

    const channelHint = email ? 'email' : 'SMS';

    return (
        <div className={styles.authWrap}>
            <div className={styles.authCard}>
                <div className={styles.authBrand}>
                    <div className={styles.authBrandIcon}>📐</div>
                    <div className={styles.authBrandName}>NirmanIQ</div>
                    <div className={styles.authBrandTag}>Construction Intelligence</div>
                </div>

                {/* Step indicator */}
                <div className={styles.stepIndicator}>
                    {STEPS.map((s, i) => (
                        <React.Fragment key={s}>
                            <div className={`${styles.stepDot} ${i < step ? styles.stepDone : i === step ? styles.stepActive : ''}`}>
                                {i < step ? '✓' : i + 1}
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
                <div className={styles.stepLabel}>{STEP_LABELS[step]}</div>

                {/* Step 0: Details */}
                {step === 0 && (
                    <>
                        <h2 className={styles.authTitle}>Create account</h2>
                        <form onSubmit={handleDetails} className={styles.authForm}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Full name *</label>
                                <input value={name} onChange={e => setName(e.target.value)}
                                    placeholder="Kappagantula Somasekhara Kalyana" autoFocus />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Email address</label>
                                <input type="email" value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com" autoComplete="email" />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Mobile number</label>
                                <div className={styles.phoneWrap}>
                                    <span className={styles.phonePrefix}>+91</span>
                                    <input value={phone}
                                        onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                                        placeholder="98765 43210"
                                        inputMode="numeric" />
                                </div>
                                <div className={styles.fieldHint}>OTP will be sent to email or mobile for verification</div>
                            </div>
                            {error && <div className={styles.authError}>⚠ {error}</div>}
                            <button className={styles.authBtn} type="submit">Continue →</button>
                        </form>
                    </>
                )}

                {/* Step 1: Password */}
                {step === 1 && (
                    <>
                        <h2 className={styles.authTitle}>Set your password</h2>
                        <form onSubmit={handlePassword} className={styles.authForm}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Password</label>
                                <div className={styles.passWrap}>
                                    <input type={showPass ? 'text' : 'password'} value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Minimum 8 characters" autoFocus
                                        autoComplete="new-password" />
                                    <button type="button" className={styles.passToggle}
                                        onClick={() => setShowPass(s => !s)}>
                                        {showPass ? '🙈' : '👁'}
                                    </button>
                                </div>
                                {password && (
                                    <div className={styles.pwStrengthBar}>
                                        {[1,2,3,4].map(n => (
                                            <div key={n} className={styles.pwStrengthSeg}
                                                style={{ background: ps >= n ? strengthColor[ps] : 'var(--border)' }} />
                                        ))}
                                        <span style={{ color: strengthColor[ps], fontSize: 11, marginLeft: 6 }}>
                                            {strengthLabel[ps]}
                                        </span>
                                    </div>
                                )}
                                <div className={styles.pwRules}>
                                    {[
                                        [password.length >= 8,        '8+ characters'],
                                        [/[A-Z]/.test(password),      'Uppercase letter'],
                                        [/[0-9]/.test(password),      'Number'],
                                        [/[^A-Za-z0-9]/.test(password),'Special character (optional)'],
                                    ].map(([ok, label]) => (
                                        <span key={label} className={ok ? styles.pwRuleOk : styles.pwRuleFail}>
                                            {ok ? '✓' : '○'} {label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Confirm password</label>
                                <input type="password" value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    placeholder="Re-enter password"
                                    autoComplete="new-password" />
                                {confirm && confirm !== password && (
                                    <div style={{ fontSize:11, color:'var(--red)', marginTop:3 }}>Passwords don't match</div>
                                )}
                            </div>
                            {error && <div className={styles.authError}>⚠ {error}</div>}
                            <button className={styles.authBtn} type="submit" disabled={loading}>
                                {loading ? <span className={styles.spinner}/> : 'Create account →'}
                            </button>
                        </form>
                        <button className={styles.authBack} onClick={() => { setStep(0); setError(''); }}>
                            ← Back
                        </button>
                    </>
                )}

                {/* Step 2: OTP verification */}
                {step === 2 && (
                    <>
                        <h2 className={styles.authTitle}>Verify your account</h2>
                        <p className={styles.authSub}>
                            OTP sent to your {channelHint}
                            {' '}<strong>{email || phone}</strong>
                        </p>

                        {devOtp && (
                            <div className={styles.devOtpBanner}>
                                <div className={styles.devOtpLabel}>🛠 DEV MODE — OTP:</div>
                                <div className={styles.devOtpCode}>{devOtp}</div>
                                <div className={styles.devOtpNote}>Configure SMTP/SMS in .env to enable real delivery</div>
                            </div>
                        )}

                        <form onSubmit={handleVerify} className={styles.authForm}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>6-digit OTP</label>
                                <input type="text" inputMode="numeric" pattern="[0-9]*"
                                    maxLength={6} value={otp} autoFocus
                                    onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                                    placeholder="000000"
                                    className={styles.otpInput} />
                                {otpTimer > 0 && (
                                    <div className={styles.otpTimer}>
                                        Expires in {Math.floor(otpTimer/60)}:{String(otpTimer%60).padStart(2,'0')}
                                    </div>
                                )}
                            </div>
                            {error && <div className={styles.authError}>⚠ {error}</div>}
                            <button className={styles.authBtn} type="submit"
                                disabled={loading || otp.length < 6}>
                                {loading ? <span className={styles.spinner}/> : 'Verify & continue →'}
                            </button>
                        </form>

                        <div className={styles.authFooter}>
                            <span>Didn't receive it?</span>
                            <button className={styles.authLink} onClick={resendOtp}
                                disabled={loading || otpTimer > 270}>
                                Resend OTP
                            </button>
                        </div>
                    </>
                )}

                <div className={styles.authFooterMain}>
                    <span>Already have an account?</span>
                    <button className={styles.authLink} onClick={onCancel}>Sign in</button>
                </div>
            </div>
        </div>
    );
}

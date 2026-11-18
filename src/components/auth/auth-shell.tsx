import '@/app/cssd/cssd.css';
import '@/app/cssd/workflow.css';
import './auth.css';

/** Kerangka halaman di luar ruang kerja: masuk, pemasangan, ganti kata sandi. */
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="auth" id="konten">
      <div className="auth__panel">
        <p className="auth__brand">
          <span className="brand__name">SIMRS</span> <span className="brand__module">CSSD</span>
        </p>
        <h1>{title}</h1>
        <p className="auth__description">{description}</p>
        {children}
      </div>
    </main>
  );
}

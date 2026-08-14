import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { TerctlLoader } from './TerctlLogo';
import { appVersionAtom } from '../../store/version';

const LOGO = 150;

export function BootSplash() {
  const [booting, setBooting] = useState(true);
  const [gone, setGone] = useState(false);
  const version = useAtomValue(appVersionAtom);

  useEffect(() => {
    // Hold for one full loader cycle (loader cycle = 2.4s) — the frame
    // assembles and disassembles once — then fade to the dashboard and unmount
    // so nothing lingers in the DOM.
    const HOLD = 2400;
    const done = setTimeout(() => setBooting(false), HOLD);
    const remove = setTimeout(() => setGone(true), HOLD + 320);
    return () => {
      clearTimeout(done);
      clearTimeout(remove);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background:
          'radial-gradient(120% 100% at 50% 42%, color-mix(in srgb, var(--brand) 8%, var(--background)) 0%, var(--background) 50%, var(--bg-deep) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: booting ? 1 : 0,
        pointerEvents: booting ? 'auto' : 'none',
        transition: 'opacity 0.28s ease',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <TerctlLoader size={LOGO} glow={false} />

        {/* wordmark */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 44,
            animation: 'bootword 0.7s ease 0.1s both',
          }}
        >
          <div
            style={{
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: 1,
              lineHeight: 1,
            }}
          >
            Ter<span style={{ color: 'var(--text-dim)' }}>CTL</span>
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-muted)',
              marginTop: 13,
              letterSpacing: 0.2,
            }}
          >
            Your servers, one keystroke away.
          </div>
        </div>

        <div
          style={{
            marginTop: 34,
            animation: 'bootword 0.7s ease 0.25s both',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 16px',
            borderRadius: 11,
            background: 'color-mix(in srgb, var(--foreground) 4%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
          }}
        >
          <span
            style={{
              color: 'var(--green)',
              animation: 'bootBreathe 1.8s ease-in-out infinite',
            }}
          >
            ●
          </span>
          <span style={{ color: 'var(--text-dim)' }}>
            establishing secure channel
          </span>
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 15,
              background: 'var(--brand)',
              animation: 'bootcaret 1s steps(1) infinite',
            }}
          />
        </div>

        <div
          style={{
            marginTop: 26,
            animation: 'bootword 0.7s ease 0.4s both',
            width: 240,
            height: 3,
            borderRadius: 3,
            background: 'color-mix(in srgb, var(--foreground) 9%, transparent)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '32%',
              height: '100%',
              borderRadius: 3,
              background: 'var(--gradient-brand)',
              animation: 'bootbar 1.6s cubic-bezier(0.5,0,0.5,1) infinite',
            }}
          />
        </div>
      </div>

      {/* footer */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 34,
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-faint)',
          letterSpacing: 0.5,
        }}
      >
        terctl{version ? ` v${version}` : ''}
      </div>
    </div>
  );
}

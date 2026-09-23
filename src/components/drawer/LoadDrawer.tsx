import { Fragment, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { StatusPill } from '../ui/StatusPill';
import { t } from '../../i18n/messages';
import { canEditResources, canSeeCost, canSeeMargin, canSeeRevenue } from '../../lib/permissions';
import { SITES } from '../../lib/status';
import { SEFS_SOURCES } from '../../lib/sefs';
import { isReadyBlocked, evaluateLoadCover } from '../../lib/permits';
import { downloadDocumentsZip } from '../../lib/zipDocs';
import { readFileAsDataUrl } from '../../lib/docsIo';
import { DocPreview } from '../ui/DocPreview';
import { DocFileRow } from '../ui/DocFileRow';

type Tab = 'overview' | 'timeline' | 'docs' | 'pricing' | 'chat';

function fmtDim(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}


/** ISO / Z → datetime-local value in Europe/Warsaw (YYYY-MM-DDTHH:mm). */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // already local-ish
    return iso.slice(0, 16);
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** datetime-local → ISO with Warsaw +02:00 (makieta CEST). */
function datetimeLocalToIso(local: string | null | undefined): string | null {
  if (!local) return null;
  const v = String(local).trim();
  if (!v) return null;
  if (v.includes('+') || v.endsWith('Z')) return v;
  // Ensure seconds
  const base = v.length === 16 ? `${v}:00` : v;
  return `${base}+02:00`;
}


export function LoadDrawer() {
  const id = useTowerStore((s) => s.selectedLoadId);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const loads = useTowerStore((s) => s.loads);
  const events = useTowerStore((s) => s.events);
  const documents = useTowerStore((s) => s.documents);
  const messages = useTowerStore((s) => s.messages);
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const updateResources = useTowerStore((s) => s.updateResources);
  const updateAwizacja = useTowerStore((s) => s.updateAwizacja);
  const updateFerry = useTowerStore((s) => s.updateFerry);
  const setLoadStatus = useTowerStore((s) => s.setLoadStatus);
  const assignScx = useTowerStore((s) => s.assignScx);
  const triggerGeofence = useTowerStore((s) => s.triggerGeofence);
  const geofences = useTowerStore((s) => s.geofences);
  const uploadDocument = useTowerStore((s) => s.uploadDocument);
  const sendMessage = useTowerStore((s) => s.sendMessage);

  const [tab, setTab] = useState<Tab>('overview');
  const [chat, setChat] = useState('');
  const [previewDoc, setPreviewDoc] = useState<import('../../types').Document | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadCat, setUploadCat] = useState<import('../../types').Document['category'] | null>(null);

  const load = loads.find((l) => l.id === id);
  const loadEvents = useMemo(
    () => (load ? events.filter((e) => e.loadId === load.id).sort((a, b) => (a.at < b.at ? 1 : -1)) : []),
    [events, load],
  );
  const loadDocs = useMemo(
    () => (load ? documents.filter((d) => d.loadId === load.id) : []),
    [documents, load],
  );
  const loadMsgs = useMemo(
    () => (load ? messages.filter((m) => m.loadId === load.id) : []),
    [messages, load],
  );

  if (!load) return null;

  const showCost = canSeeCost(role);
  const showRev = canSeeRevenue(role);
  const showMargin = canSeeMargin(role);
  const canEdit = canEditResources(role);
  const readyGate = isReadyBlocked(load, loadDocs);
  const permitBlock = readyGate.blocked;
  const coverInfo = evaluateLoadCover(load, loadDocs);
  const readyUiBlocked = permitBlock || !coverInfo.covered || load.docMissing || load.permitFits === false;
  const comboL = load.resources.setLengthM ?? load.dims.lengthM;
  const comboW = load.resources.setWidthM ?? load.dims.widthM;
  const comboH = load.resources.setHeightM ?? load.dims.heightM;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t(locale, 'tab_overview') },
    { id: 'timeline', label: t(locale, 'tab_timeline') },
    { id: 'docs', label: t(locale, 'tab_docs') },
    { id: 'pricing', label: t(locale, 'tab_pricing') },
    { id: 'chat', label: t(locale, 'tab_chat') },
  ];

  return (
    <>
      <button type="button" className="scrim" aria-label="Zamknij" onClick={() => selectLoad(null)} />
      <aside className="drawer" role="dialog" aria-label={load.code}>
        <div className="drawer-hd">
          <div className="r1">
            <span className="wb-code">{load.code}</span>
            <StatusPill status={load.status} stage={load.stage} />
            {load.delayed ? <span className="pill p-red">+1h 35 min</span> : null}
            <div className="spacer" />
            <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={() => selectLoad(null)}>
              ✕
            </button>
          </div>
          <div className="wb-fields">
            <span>
              <b>Zlecenie</b>
              <em>{load.permit?.pozycja || `HHL/2026/${1240 + load.sequenceOrder}`}</em>
            </span>
            <span>
              <b>Nadawca</b>
              <em>{SITES.loading.name}</em>
            </span>
            <span>
              <b>Odbiorca</b>
              <em>Stegra, Boden</em>
            </span>
            <span>
              <b>Tydzień dostawy</b>
              <em>
                t
                {(() => {
                  const d = new Date(load.plannedDeliverDate);
                  if (Number.isNaN(d.getTime())) return '—';
                  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                  const day = tmp.getUTCDay() || 7;
                  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
                  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
                  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                })()}
              </em>
            </span>
          </div>
          <div className="perf" />
        </div>

        <div className="dtabs">
          {tabs.map((x) => (
              <button key={x.id} type="button" onClick={() => setTab(x.id)} aria-selected={tab === x.id}>
                {x.label}
              </button>
            ))}
        </div>

        <div className="dbody">
          {tab === 'overview' && (
            <>
              <dl className="kv">
                <dt>Typ</dt>
                <dd>
                  {load.itemType} · {load.qty} szt.
                </dd>
                <dt>Wymiary L×W×H</dt>
                <dd>
                  {fmtDim(load.dims.lengthM)} × {fmtDim(load.dims.widthM)} × {fmtDim(load.dims.heightM)} m
                </dd>
                <dt>Wymiary zestawu</dt>
                <dd>
                  {comboL > 16.5 || comboW > 2.55 ? (
                    <span className="board" title="Ładunek ponadnormatywny" />
                  ) : null}
                  {fmtDim(comboL)} × {fmtDim(comboW)} × {fmtDim(comboH)} m
                </dd>
                <dt>Masa</dt>
                <dd>
                  {fmtDim(load.dims.weightT)} t ({load.qty} ×{' '}
                  {fmtDim(load.dims.weightT / Math.max(1, load.qty))} t)
                </dd>
                <dt>Nr zlecenia</dt>
                <dd>{load.permit?.pozycja || `HHL/2026/${1240 + load.sequenceOrder}`}</dd>
                <dt>Montaż</dt>
                <dd>pozycja {load.sequenceOrder}</dd>
                <dt>Miejsce załadunku</dt>
                <dd>{SITES.loading.name}</dd>
                <dt>Załadunek</dt>
                <dd className="cond">{fmtWhen(load.plannedLoadDate)}</dd>
                <dt>Dostawa</dt>
                <dd className="cond">{fmtWhen(load.plannedDeliverDate)}</dd>
                <dt>{t(locale, 'eta')}</dt>
                <dd className="cond">
                  {fmtWhen(load.etaBoden)}{' '}
                  {load.delayed ? (
                    <span className="pill p-red">+1h 35 min</span>
                  ) : (
                    <span className="pill p-go">w oknie</span>
                  )}
                  {' '}
                  <span
                    className={`pill ${
                      load.etaConfidence === 'LOW'
                        ? 'p-red'
                        : load.etaConfidence === 'HIGH'
                          ? 'p-go'
                          : 'p-amber'
                    }`}
                  >
                    {load.etaConfidence}
                  </span>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4, fontWeight: 400 }}>
                    pasmo {load.etaEarliestHours.toFixed(1)}–{load.etaLatestHours.toFixed(1)} h · heurystyka
                    {load.etaReasons?.length ? ` · ${load.etaReasons.slice(0, 3).join(' · ')}` : ''}
                  </div>
                </dd>
                <dt>Kierowca</dt>
                <dd>
                  {load.resources.driverName ? (
                    <>
                      {load.resources.driverName}
                      {load.resources.driverPhone ? ` · ${load.resources.driverPhone}` : ''}
                    </>
                  ) : (
                    <span style={{ color: 'var(--red)' }}>nie uzupełniono</span>
                  )}
                </dd>
                <dt>Ciągnik / naczepa</dt>
                <dd>
                  {load.resources.tractorPlate ? (
                    <>
                      <span className="mono">{load.resources.tractorPlate}</span>
                      {' / '}
                      <span className="mono">{load.resources.trailerPlate ?? '—'}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>Pilotaż</dt>
                <dd>
                  {load.resources.escort
                    ? load.resources.escortPlate
                      ? `1 pojazd · ${load.resources.escortPlate}`
                      : '1 pojazd'
                    : 'nie wymagany'}
                </dd>
                <dt>Prom</dt>
                <dd>
                  {load.ferry.vessel
                    ? `${load.ferry.vessel}${load.ferry.bookingRef ? ` · ${load.ferry.bookingRef}` : ''}`
                    : 'brak rezerwacji'}
                </dd>
              </dl>

              {readyUiBlocked ? (
                <div className="banner red" style={{ margin: '13px 0 0' }}>
                  <b>Brak zezwolenia.</b> Zestaw ma {fmtDim(comboL)} m długości — transport nie może ruszyć bez
                  dokumentu obejmującego ten wymiar.
                </div>
              ) : (
                <div
                  className="banner"
                  style={{ margin: '13px 0 0', background: 'var(--go-bg)', borderLeftColor: 'var(--go)' }}
                >
                  <b>Zezwolenie zgodne.</b> Wymiary zestawu mieszczą się w limitach dokumentu PL/2026/
                  {1400 + load.sequenceOrder} ważnego do 30.11.2026.
                </div>
              )}
            </>
          )}

          {tab === 'timeline' && (
            <ul className="tl">
              {loadEvents.length === 0 ? (
                <li className="future">
                  <span className="mk" />
                  <div className="w">Brak zdarzeń</div>
                  <div className="ts">—</div>
                </li>
              ) : (
                loadEvents.map((e) => (
                  <li key={e.id}>
                    <span className="mk" />
                    <div className="w">
                      {e.type}
                      {e.note ? ` · ${e.note}` : ''}
                    </div>
                    <div className="ts">
                      {e.actor} · {e.at}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}

          {tab === 'docs' && (
            <>
              {loadDocs.map((d) => (
                <DocFileRow
                  key={d.id}
                  doc={d}
                  onPreview={setPreviewDoc}
                  showUpload={canEdit && role !== 'KSH'}
                  onUploadClick={() => {
                    setUploadCat(d.category);
                    fileRef.current?.click();
                  }}
                />
              ))}
              <div style={{ marginTop: 13 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    void downloadDocumentsZip(loadDocs, `${load.code}_dokumenty.zip`).then((r) => {
                      useTowerStore.getState().pushToast(
                        `ZIP ${load.code}: ${r.count} plików`,
                        'MEDIUM',
                        load.id,
                      );
                    });
                  }}
                >
                  Pobierz paczkę ZIP
                </button>
                {role !== 'KSH' ? (
                  <button
                    type="button"
                    className="btn"
                    style={{ marginLeft: 7 }}
                    onClick={() => {
                      const missing = loadDocs.find((d) => d.status === 'MISSING');
                      setUploadCat(missing?.category ?? 'CMR');
                      fileRef.current?.click();
                    }}
                  >
                    Wgraj dokument
                  </button>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="sronly"
                  aria-label="Wybierz plik dokumentu"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    const cat = uploadCat ?? loadDocs.find((d) => d.status === 'MISSING')?.category ?? 'CMR';
                    void readFileAsDataUrl(f)
                      .then((r) => {
                        uploadDocument(load.id, cat, r.name || `${cat}_${load.code}.pdf`, {
                          dataUrl: r.dataUrl,
                          mimeType: r.mimeType,
                          bytes: r.bytes,
                        });
                      })
                      .catch(() => {
                        useTowerStore.getState().pushToast('Nie udało się odczytać pliku', 'HIGH', load.id);
                      });
                  }}
                />
              </div>
            </>
          )}

          {tab === 'pricing' && (
            <>
              {showCost ? (
                <>
                  <h4 className="sec">{t(locale, 'cost')} — Scandinavian Express</h4>
                  <div className="mrow">
                    <span className="lbl">Stawka bazowa</span>
                    <span>{load.pricing.costBase.toLocaleString('pl-PL')} PLN</span>
                  </div>
                  <div className="mrow">
                    <span className="lbl">Dodatek paliwowy</span>
                    <span>{load.pricing.costSefs.toLocaleString('pl-PL')} PLN</span>
                  </div>
                  <div className="mrow">
                    <span className="lbl">Dodatki</span>
                    <span>{load.pricing.costExtras.toLocaleString('pl-PL')} PLN</span>
                  </div>
                  <div className="mrow total">
                    <span>Razem</span>
                    <span>{load.pricing.costTotal.toLocaleString('pl-PL')} PLN</span>
                  </div>
                </>
              ) : (
                <div className="locked">{t(locale, 'no_price')}</div>
              )}
              {showRev ? (
                <>
                  <h4 className="sec" style={{ marginTop: 15 }}>
                    {t(locale, 'revenue')} — KSH
                  </h4>
                  <div className="mrow">
                    <span className="lbl">Stawka bazowa</span>
                    <span>{load.pricing.revBase.toLocaleString('pl-PL')} PLN</span>
                  </div>
                  <div className="mrow">
                    <span className="lbl">Dodatek paliwowy</span>
                    <span>{load.pricing.revSefs.toLocaleString('pl-PL')} PLN</span>
                  </div>
                  <div className="mrow total">
                    <span>Razem</span>
                    <span>{load.pricing.revTotal.toLocaleString('pl-PL')} PLN</span>
                  </div>
                </>
              ) : (
                <div className="locked" style={{ marginTop: 13 }}>
                  {t(locale, 'no_price')}
                </div>
              )}
              {showMargin ? (
                <div className="mrow total" style={{ marginTop: 15, borderTop: '2px solid var(--ink)' }}>
                  <span>{t(locale, 'margin')}</span>
                  <span style={{ color: load.pricing.marginPct < 0.18 ? 'var(--red)' : 'var(--go)' }}>
                    {load.pricing.margin.toLocaleString('pl-PL')} PLN · {(load.pricing.marginPct * 100).toFixed(1)}%
                  </span>
                </div>
              ) : null}
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10 }}>
                <a href={SEFS_SOURCES.orlen} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                  ORLEN
                </a>
                {' · '}
                <a href={SEFS_SOURCES.okq8} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                  OKQ8
                </a>
              </div>
            </>
          )}

          {tab === 'chat' && (
            <>
              {!canEdit && (
                <>
                  <div className="note" style={{ margin: '0 0 12px' }}>
                    «Edycja zasobów i awizacji: Scandinavian Express / H&H Logistics»
                  </div>
                  <h4 className="sec">Zasoby</h4>
                  <dl className="kv">
                    <dt>Kierowca</dt>
                    <dd>{load.resources.driverName ?? '—'}</dd>
                    <dt>Telefon</dt>
                    <dd>{load.resources.driverPhone ?? '—'}</dd>
                    <dt>Ciągnik</dt>
                    <dd>
                      <span className="mono">{load.resources.tractorPlate ?? '—'}</span>
                    </dd>
                    <dt>Naczepa</dt>
                    <dd>
                      <span className="mono">{load.resources.trailerPlate ?? '—'}</span>
                    </dd>
                    <dt>Pilotaż</dt>
                    <dd>
                      {load.resources.escort
                        ? load.resources.escortPlate
                          ? `1 pojazd · ${load.resources.escortPlate}`
                          : '1 pojazd'
                        : 'nie wymagany'}
                    </dd>
                    <dt>Zestaw L×W×H</dt>
                    <dd>
                      {fmtDim(comboL)} × {fmtDim(comboW)} × {fmtDim(comboH)} m
                    </dd>
                    <dt>Masa zestawu</dt>
                    <dd>{fmtDim(load.resources.setWeightT ?? load.dims.weightT)} t</dd>
                  </dl>
                  <h4 className="sec" style={{ marginTop: 18 }}>
                    Awizacja / Prom
                  </h4>
                  <dl className="kv">
                    <dt>Okno załad.</dt>
                    <dd>
                      {fmtWhen(load.awizacja.loadWindowStart)} – {fmtWhen(load.awizacja.loadWindowEnd)}
                    </dd>
                    <dt>Prom</dt>
                    <dd>{load.ferry.vessel ?? 'brak rezerwacji'}</dd>
                    <dt>Rezerwacja</dt>
                    <dd>{load.ferry.bookingRef ?? '—'}</dd>
                    <dt>Status promu</dt>
                    <dd>{load.ferry.status}</dd>
                    <dt>Wyjazd / Przyjazd</dt>
                    <dd>
                      {load.ferry.departureAt ?? '—'} / {load.ferry.arrivalAt ?? '—'}
                    </dd>
                    <dt>Potwierdzona</dt>
                    <dd>{load.awizacja.confirmed ? 'tak' : 'nie'}</dd>
                  </dl>
                </>
              )}
              {canEdit && (
                <>
                  <h4 className="sec" style={{ marginTop: 18 }}>
                    Zasoby
                  </h4>
                  <form
                    key={`res-${load.id}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      updateResources(load.id, {
                        driverName: String(fd.get('driverName') || '') || null,
                        driverPhone: String(fd.get('driverPhone') || '') || null,
                        tractorPlate: String(fd.get('tractorPlate') || '') || null,
                        trailerPlate: String(fd.get('trailerPlate') || '') || null,
                        escort: fd.get('escort') === 'on',
                        escortPlate: String(fd.get('escortPlate') || '') || null,
                        setLengthM: Number(fd.get('setLengthM')) || null,
                        setWidthM: Number(fd.get('setWidthM')) || null,
                        setHeightM: Number(fd.get('setHeightM')) || null,
                        setWeightT: Number(fd.get('setWeightT')) || null,
                      });
                    }}
                  >
                    <dl className="kv">
                      {(
                        [
                          ['driverName', 'Kierowca', load.resources.driverName],
                          ['driverPhone', 'Telefon', load.resources.driverPhone],
                          ['tractorPlate', 'Ciągnik', load.resources.tractorPlate],
                          ['trailerPlate', 'Naczepa', load.resources.trailerPlate],
                        ] as const
                      ).map(([name, label, val]) => (
                        <Fragment key={name}>
                          <dt>{label}</dt>
                          <dd>
                            <input name={name} className="input" style={{ width: '100%' }} defaultValue={val ?? ''} />
                          </dd>
                        </Fragment>
                      ))}
                      <dt>Pilotaż</dt>
                      <dd>
                        <label>
                          <input name="escort" type="checkbox" defaultChecked={load.resources.escort} /> włączony
                        </label>
                        {' · '}
                        <input
                          name="escortPlate"
                          className="input"
                          placeholder="Nr rej. pilotażu"
                          style={{ width: '55%' }}
                          defaultValue={load.resources.escortPlate ?? ''}
                        />
                      </dd>
                      <dt>Zestaw L×W×H</dt>
                      <dd>
                        <input
                          name="setLengthM"
                          className="input"
                          style={{ width: '30%' }}
                          defaultValue={load.resources.setLengthM ?? ''}
                          placeholder="L"
                        />{' '}
                        <input
                          name="setWidthM"
                          className="input"
                          style={{ width: '30%' }}
                          defaultValue={load.resources.setWidthM ?? ''}
                          placeholder="W"
                        />{' '}
                        <input
                          name="setHeightM"
                          className="input"
                          style={{ width: '30%' }}
                          defaultValue={load.resources.setHeightM ?? ''}
                          placeholder="H"
                        />
                      </dd>
                      <dt>Masa zestawu</dt>
                      <dd>
                        <input
                          name="setWeightT"
                          className="input"
                          style={{ width: '40%' }}
                          defaultValue={load.resources.setWeightT ?? ''}
                          placeholder="t"
                        />
                      </dd>
                    </dl>
                    <button type="submit" className="btn ghost" style={{ marginTop: 8 }}>
                      Zapisz zasoby
                    </button>
                  </form>

                  <h4 className="sec" style={{ marginTop: 18 }}>
                    Awizacja / Prom
                  </h4>
                  <form
                    key={`awi-${load.id}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      updateAwizacja(load.id, {
                        loadWindowStart: datetimeLocalToIso(String(fd.get('loadWindowStart') || '')),
                        loadWindowEnd: datetimeLocalToIso(String(fd.get('loadWindowEnd') || '')),
                        unloadWindowStart: datetimeLocalToIso(String(fd.get('unloadWindowStart') || '')),
                        unloadWindowEnd: datetimeLocalToIso(String(fd.get('unloadWindowEnd') || '')),
                        confirmed: fd.get('confirmed') === 'on',
                      });
                      updateFerry(load.id, {
                        vessel: (String(fd.get('vessel') || '') as 'Wawel' | 'Nova Star') || null,
                        departureAt: datetimeLocalToIso(String(fd.get('departureAt') || '')),
                        arrivalAt: datetimeLocalToIso(String(fd.get('arrivalAt') || '')),
                        bookingRef: String(fd.get('bookingRef') || '') || null,
                        status: String(fd.get('status') || 'BOOKED') as typeof load.ferry.status,
                      });
                    }}
                  >
                    <dl className="kv">
                      <dt>Okno załad. (od–do)</dt>
                      <dd>
                        <input
                          name="loadWindowStart"
                          type="datetime-local"
                          className="input"
                          style={{ width: '48%' }}
                          defaultValue={isoToDatetimeLocal(load.awizacja.loadWindowStart)}
                          required
                        />{' '}
                        <input
                          name="loadWindowEnd"
                          type="datetime-local"
                          className="input"
                          style={{ width: '48%' }}
                          defaultValue={isoToDatetimeLocal(load.awizacja.loadWindowEnd)}
                          required
                        />
                      </dd>
                      <dt>Prom</dt>
                      <dd>
                        <select name="vessel" className="input" defaultValue={load.ferry.vessel ?? 'Wawel'}>
                          <option>Wawel</option>
                          <option>Nova Star</option>
                        </select>
                      </dd>
                      <dt>Rezerwacja</dt>
                      <dd>
                        <input
                          name="bookingRef"
                          className="input"
                          style={{ width: '100%' }}
                          defaultValue={load.ferry.bookingRef ?? ''}
                        />
                      </dd>
                      <dt>Status promu</dt>
                      <dd>
                        <select name="status" className="input" defaultValue={load.ferry.status}>
                          {['NONE', 'BOOKED', 'CHECKED_IN', 'ONBOARD', 'LANDED', 'DELAYED', 'CANCELLED'].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </dd>
                      <dt>Wyjazd / Przyjazd</dt>
                      <dd>
                        <input
                          name="departureAt"
                          type="datetime-local"
                          className="input"
                          style={{ width: '48%' }}
                          defaultValue={isoToDatetimeLocal(load.ferry.departureAt)}
                        />{' '}
                        <input
                          name="arrivalAt"
                          type="datetime-local"
                          className="input"
                          style={{ width: '48%' }}
                          defaultValue={isoToDatetimeLocal(load.ferry.arrivalAt)}
                        />
                      </dd>
                      <dt>Potwierdzona</dt>
                      <dd>
                        <label>
                          <input name="confirmed" type="checkbox" defaultChecked={load.awizacja.confirmed} /> tak
                        </label>
                      </dd>
                      <input type="hidden" name="unloadWindowStart" defaultValue={isoToDatetimeLocal(load.awizacja.unloadWindowStart)} />
                      <input type="hidden" name="unloadWindowEnd" defaultValue={isoToDatetimeLocal(load.awizacja.unloadWindowEnd)} />
                    </dl>
                    <button type="submit" className="btn ghost" style={{ marginTop: 8 }}>
                      Zapisz awizację
                    </button>
                  </form>
                </>
              )}

              <div className="hr" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {role === 'HHL' && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => assignScx(load.id, load.pricing.scxPozycja ?? 'cennik SCX')}
                  >
                    Przypisz SCX
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={readyUiBlocked}
                  title={permitBlock ? readyGate.reason : undefined}
                  onClick={() => {
                    if (readyUiBlocked) return;
                    setLoadStatus(load.id, 'READY', role, 'Ręczne READY');
                  }}
                >
                  Ustaw READY
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={readyUiBlocked}
                  title={permitBlock ? readyGate.reason : undefined}
                  onClick={() => {
                    if (readyUiBlocked) return;
                    setLoadStatus(load.id, 'IN_TRANSIT_PL', role);
                  }}
                >
                  Wyjazd
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    const gf = geofences.find((g) => g.type === 'PRE_ARRIVAL') ?? geofences[0];
                    if (gf) triggerGeofence(load.id, gf.id);
                  }}
                >
                  Zdarzenie strefy
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setLoadStatus(load.id, 'UNLOADING', role, 'Rozładowano → POD')}
                >
                  Oznacz rozładowany
                </button>
              </div>

              {loadMsgs.map((m) => (
                <div key={m.id} className={`msg${m.org === 'HHL' ? ' me' : ''}`}>
                  <div className="who">
                    {m.author} · {m.org} · {m.at}
                  </div>
                  <div>{m.text}</div>
                </div>
              ))}
              <form
                className="chatbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chat.trim()) return;
                  sendMessage(load.id, chat.trim());
                  setChat('');
                }}
              >
                <input value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Napisz do pozostałych stron…" />
                <button type="submit" className="btn">
                  Wyślij
                </button>
              </form>
            </>
          )}
        </div>
      </aside>
      <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  );
}

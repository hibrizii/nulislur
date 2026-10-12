import React, { useState } from 'react';
import { 
  KeyRound, 
  RefreshCw, 
  Copy, 
  RotateCcw, 
  Search, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  Eye 
} from 'lucide-react';
import type { MigrasiRedeemItem, MigrasiRedeemNaskah } from '../../../types';
import { NeoModal } from '../../Common/NeoModal';

interface TabMigrasiRedeemProps {
  redeemList: MigrasiRedeemItem[];
  onRefresh: () => Promise<void>;
  onResetAllTesting: () => Promise<void>;
  onResetItem: (kode: string) => Promise<void>;
  onCopyWhatsApp: () => void;
  notice: { type: 'success' | 'error'; text: string } | null;
  onDismissNotice: () => void;
}

export const TabMigrasiRedeem: React.FC<TabMigrasiRedeemProps> = ({
  redeemList,
  onRefresh,
  onResetAllTesting,
  onResetItem,
  onCopyWhatsApp,
  notice,
  onDismissNotice,
}) => {
  const [filter, setFilter] = useState<'semua' | 'belum' | 'sudah'>('semua');
  const [search, setSearch] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedItemDetail, setSelectedItemDetail] = useState<MigrasiRedeemItem | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Salin Kode
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Metrik Statistik
  const totalKlaimSelesai = redeemList.filter((r) => r.isRedeemed).length;
  const totalBelumKlaim = redeemList.filter((r) => !r.isRedeemed).length;
  const totalKaryaSemua = redeemList.reduce((acc, r) => acc + (r.naskahList?.length || 0), 0);

  // Filter List
  const filteredList = redeemList.filter((r) => {
    if (filter === 'belum' && r.isRedeemed) return false;
    if (filter === 'sudah' && !r.isRedeemed) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = r.originalNama.toLowerCase().includes(q);
      const matchCode = r.kodeRedeem.toLowerCase().includes(q);
      const matchClaimedBy = r.redeemedByUsername?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchClaimedBy) return false;
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2.5 animate-in fade-in duration-200">
      {/* Header Tab (Shrink-0) */}
      <div className="shrink-0 editorial-card p-3 sm:px-4 sm:py-2.5 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 flex items-center gap-1">
              <KeyRound size={11} /> Migrasi Firebase
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold font-serif-literary text-stone-900 dark:text-stone-100">
            Kode Redeem & Migrasi Karya Lama
          </h2>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">
            Siswa cukup mendaftar akun baru lalu memasukkan kode unik ini di menu &quot;Klaim Karya Lama&quot;.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 py-1.5 px-2.5 text-xs font-medium cursor-pointer flex items-center gap-1 rounded-xl"
            title="Muat ulang data dari server"
          >
            <RefreshCw size={12} /> <span className="hidden sm:inline">Muat Ulang</span>
          </button>

          <button
            onClick={onCopyWhatsApp}
            className="editorial-btn bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5 rounded-xl"
            title="Salin seluruh kode dalam format siap kirim WhatsApp"
          >
            <Copy size={13} /> <span>Format WhatsApp</span>
          </button>

          <button
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                title: 'Reset Semua Klaim Testing?',
                description: 'Seluruh kode redeem akan dikembalikan ke status BELUM DIKLAIM agar siap dibagikan ke siswa asli. Lanjutkan?',
                onConfirm: async () => {
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                  await onResetAllTesting();
                },
              });
            }}
            disabled={totalKlaimSelesai === 0}
            className="editorial-btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60 dark:hover:bg-red-950/70 py-1.5 px-2.5 text-xs font-medium cursor-pointer disabled:opacity-40 flex items-center gap-1 rounded-xl"
            title="Reset status klaim semua kode setelah guru selesai testing"
          >
            <RotateCcw size={12} /> <span className="hidden sm:inline">Reset Klaim Testing</span>
          </button>
        </div>
      </div>

      {/* Notice Banner (Shrink-0) */}
      {notice && (
        <div
          className={`shrink-0 p-2.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
            notice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle size={15} className="shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span className="font-medium">{notice.text}</span>
          </div>
          <button onClick={onDismissNotice} className="p-1 rounded text-stone-400 hover:text-stone-600 cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Ringkasan Statistik (Shrink-0) */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="editorial-card p-3 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
            Total Siswa Terdata
          </span>
          <div className="text-xl sm:text-2xl font-black font-serif-literary text-stone-900 dark:text-stone-100">
            {redeemList.length}
          </div>
        </div>

        <div className="editorial-card p-3 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
            Total Karya Arsip
          </span>
          <div className="text-xl sm:text-2xl font-black font-serif-literary text-stone-900 dark:text-stone-100">
            {totalKaryaSemua}
          </div>
        </div>

        <div className="editorial-card p-3 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
            Sudah Diklaim
          </span>
          <div className="text-xl sm:text-2xl font-black font-serif-literary text-emerald-600 dark:text-emerald-400">
            {totalKlaimSelesai}
          </div>
        </div>

        <div className="editorial-card p-3 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
            Belum Diklaim
          </span>
          <div className="text-xl sm:text-2xl font-black font-serif-literary text-amber-600 dark:text-amber-400">
            {totalBelumKlaim}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar (Shrink-0) */}
      <div className="shrink-0 editorial-card p-2.5 bg-white dark:bg-[#141416] rounded-xl border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
        <div className="relative w-full max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama siswa, kode redeem..."
            className="editorial-input w-full pl-7 pr-3 py-1 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 dark:text-stone-100 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('semua')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              filter === 'semua'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-2xs'
                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilter('belum')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              filter === 'belum'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            Belum Diklaim ({totalBelumKlaim})
          </button>
          <button
            onClick={() => setFilter('sudah')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              filter === 'sudah'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            Sudah Diklaim ({totalKlaimSelesai})
          </button>
        </div>
      </div>

      {/* Tabel Data Redeem (Scroll Mandiri Terisolasi) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar editorial-card p-4 bg-white dark:bg-[#141416] rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider">
              <th className="pb-3">Siswa Arsip</th>
              <th className="pb-3">Kode Redeem</th>
              <th className="pb-3">Karya Arsip</th>
              <th className="pb-3">Status Klaim</th>
              <th className="pb-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-400 dark:text-stone-500">
                  Tidak ada data kode redeem yang sesuai filter.
                </td>
              </tr>
            ) : (
              filteredList.map((item) => (
                <tr key={item.kodeRedeem} className="hover:bg-stone-50/60 dark:hover:bg-stone-900/40">
                  <td className="py-3">
                    <div className="font-semibold text-stone-900 dark:text-stone-100">
                      {item.originalNama}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="inline-flex items-center gap-1.5 bg-stone-100 dark:bg-stone-850 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-750">
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tracking-wider">
                        {item.kodeRedeem}
                      </span>
                      <button
                        onClick={() => handleCopyCode(item.kodeRedeem)}
                        className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-0.5 cursor-pointer"
                        title="Salin Kode"
                      >
                        {copiedCode === item.kodeRedeem ? (
                          <Check size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 font-semibold text-stone-700 dark:text-stone-300">
                    {item.naskahList?.length || 0} Naskah
                  </td>
                  <td className="py-3">
                    {item.isRedeemed ? (
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                          Sudah Diklaim
                        </span>
                        {item.redeemedByUsername && (
                          <div className="text-[10px] text-stone-400 mt-0.5 font-mono">
                            Oleh: @{item.redeemedByUsername}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                        Belum Diklaim
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedItemDetail(item)}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        title="Lihat Detail Naskah Arsip"
                      >
                        <Eye size={14} />
                      </button>
                      {item.isRedeemed && (
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: `Reset Kode ${item.kodeRedeem}?`,
                              description: `Status klaim untuk "${item.originalNama}" akan dikembalikan ke BELUM DIKLAIM. Lanjutkan?`,
                              onConfirm: async () => {
                                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                                await onResetItem(item.kodeRedeem);
                              },
                            });
                          }}
                          className="editorial-btn bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 text-[11px] py-1 px-2 cursor-pointer"
                          title="Reset klaim testing perorangan"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Detail Naskah Arsip Siswa */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="editorial-card w-full max-w-lg bg-white dark:bg-[#141416] border border-stone-200/80 dark:border-stone-800 p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h3 className="text-base font-bold font-serif-literary text-stone-900 dark:text-stone-100">
                  Arsip Karya: {selectedItemDetail.originalNama}
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                  Kode: {selectedItemDetail.kodeRedeem}
                </p>
              </div>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-2 mb-4">
              {selectedItemDetail.naskahList?.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4">Tidak ada naskah arsip.</p>
              ) : (
                selectedItemDetail.naskahList?.map((k: MigrasiRedeemNaskah, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200/60 dark:border-stone-800 text-xs"
                  >
                    <div className="font-bold text-stone-900 dark:text-stone-100 text-sm mb-0.5">
                      {k.judul}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-stone-400">
                      <span>Status: {k.status}</span>
                      <span>{k.kataCount ? `${k.kataCount} kata` : ''}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="editorial-btn px-4 py-2 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 font-medium cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <NeoModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmColor="#DC2626"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

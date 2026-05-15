import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CampaignTable from './analytics/CampaignTable';
import SubscriberAnalyticsView from './analytics/SubscriberAnalyticsView';

const AnalyticsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState(null);

  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    setCampaignsError(null);
    try {
      const res = await axios.get('/api/listmonk/campaigns');
      setCampaigns(res.data.campaigns || []);
    } catch (err) {
      setCampaignsError(
        err.response?.data?.message || 'Gagal mengambil daftar campaign dari server.'
      );
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleSelectCampaign = useCallback(async (campaign) => {
    setSelectedCampaign(campaign);
    setAnalyticsData(null);
    setAnalyticsError(null);
    setLoadingAnalytics(true);
    try {
      const res = await axios.get(`/api/listmonk/campaigns/${campaign.id}/analytics`);
      setAnalyticsData(res.data.data);
    } catch (err) {
      setAnalyticsError(
        err.response?.data?.message || 'Gagal mengambil analytics campaign.'
      );
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCampaign(null);
    setAnalyticsData(null);
    setAnalyticsError(null);
    setLoadingAnalytics(false);
  }, []);

  return (
    <div className="min-h-screen bg-surface-950 pt-12">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Campaign Analytics</h1>
            <p className="text-sm text-surface-500 mt-0.5">
              {selectedCampaign
                ? 'Detail analytics per subscriber'
                : 'Pilih campaign untuk melihat analytics'}
            </p>
          </div>
          {!selectedCampaign && (
            <button
              onClick={fetchCampaigns}
              disabled={loadingCampaigns}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-800 hover:bg-surface-700 border border-surface-600 text-surface-300 hover:text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${loadingCampaigns ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>

        {/* Campaign list view */}
        {!selectedCampaign && (
          <>
            {loadingCampaigns && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-surface-500">Memuat daftar campaign...</span>
                </div>
              </div>
            )}

            {!loadingCampaigns && campaignsError && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl px-5 py-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-300 text-sm font-medium">Error</p>
                  <p className="text-red-400 text-xs mt-0.5">{campaignsError}</p>
                </div>
              </div>
            )}

            {!loadingCampaigns && !campaignsError && (
              <CampaignTable campaigns={campaigns} onSelect={handleSelectCampaign} />
            )}
          </>
        )}

        {/* Analytics loading */}
        {selectedCampaign && loadingAnalytics && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm text-white font-medium">Mengambil data analytics...</p>
                <p className="text-xs text-surface-500 mt-1">
                  Proses ini mengambil aktivitas per subscriber dan mungkin memakan waktu beberapa saat.
                </p>
              </div>

              {/* Progress indicator */}
              <div className="mt-2 bg-surface-800 border border-surface-700 rounded-xl px-6 py-4 max-w-sm w-full">
                <div className="flex items-center gap-2 text-xs text-surface-400">
                  <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
                  Fetching campaign info
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-400 mt-2">
                  <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                  Fetching tracked URLs
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-400 mt-2">
                  <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
                  Fetching all subscribers
                </div>
                <div className="flex items-center gap-2 text-xs text-surface-400 mt-2">
                  <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" style={{ animationDelay: '0.9s' }} />
                  Processing per-subscriber activity...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics error */}
        {selectedCampaign && !loadingAnalytics && analyticsError && (
          <div className="flex flex-col gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors w-fit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Kembali
            </button>
            <div className="bg-red-900/20 border border-red-800 rounded-xl px-5 py-4">
              <p className="text-red-300 text-sm font-medium">Gagal memuat analytics</p>
              <p className="text-red-400 text-xs mt-1">{analyticsError}</p>
            </div>
          </div>
        )}

        {/* Analytics result */}
        {selectedCampaign && !loadingAnalytics && analyticsData && (
          <SubscriberAnalyticsView
            data={analyticsData}
            campaign={analyticsData.campaign}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;

import React, { useState, useEffect, useCallback } from 'react';
import { BackgroundLayer } from './components/BackgroundLayer.js';
import { SplashScreen } from './components/SplashScreen.js';
import { Header, ActiveTab } from './components/Header.js';
import { MobileNav } from './components/MobileNav.js';
import { HomeView } from './components/views/HomeView.js';
import { TasksView } from './components/views/TasksView.js';
import { CreateCampaignView } from './components/views/CreateCampaignView.js';
import { MyCampaignsView } from './components/views/MyCampaignsView.js';
import { MyPointsView } from './components/views/MyPointsView.js';
import { MyProgressView } from './components/views/MyProgressView.js';
import { SettingsView } from './components/views/SettingsView.js';
import { AdminDashboardView } from './components/views/AdminDashboardView.js';
import { DailyBonusModal } from './components/views/DailyBonusModal.js';
import { TaskDetailsModal } from './components/views/TaskDetailsModal.js';
import { DEFAULT_THEME_CONFIG, ThemeConfig } from './config/theme.js';
import { AnonymousUser, Campaign, PointTransaction, Task } from './types.js';
import { api, getAnonymousUserId } from './services/api.js';
import { initLiveUpdateSync } from './services/liveUpdateSync.js';

const THEME_STORAGE_KEY = 'pm_ai_theme_config';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [showDailyBonusModal, setShowDailyBonusModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // User State
  const [user, setUser] = useState<AnonymousUser | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);

  // Points & Ledger State (dynamically fetched from server per user)
  const [pointsOverview, setPointsOverview] = useState({
    currentPoints: 0,
    earnedTotal: 0,
    spentTotal: 0,
    lockedCampaignBudget: 0,
    transactionsCount: 0,
  });
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  // Progress State (XP starts at 0, no daily bonus)
  const [progressData, setProgressData] = useState({
    progressPercent: 0,
    xpForNext: 100,
    canClaimToday: false,
  });

  // Theme configuration (Requirement #25 & #26)
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        try {
          return { ...DEFAULT_THEME_CONFIG, ...JSON.parse(saved) };
        } catch {
          // fallback to default
        }
      }
    }
    return DEFAULT_THEME_CONFIG;
  });

  // Save theme changes
  const handleUpdateTheme = (updates: Partial<ThemeConfig>) => {
    setThemeConfig((prev) => {
      const next = { ...prev, ...updates };
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleResetTheme = () => {
    setThemeConfig(DEFAULT_THEME_CONFIG);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  };

  // Data Loading
  const loadUserData = useCallback(async () => {
    try {
      const [userRes, tasksRes, campsRes, myCampsRes, progRes] = await Promise.all([
        api.getUserProfile(),
        api.getTasks(),
        api.getCampaigns(),
        api.getMyCampaigns(),
        api.getProgress(),
      ]);

      setUser(userRes.user);
      setTasks(tasksRes.tasks);
      setCampaigns(campsRes.campaigns);
      setMyCampaigns(myCampsRes.campaigns);
      setProgressData({
        progressPercent: progRes.progressPercent,
        xpForNext: progRes.xpForNext,
        canClaimToday: progRes.canClaimToday,
      });
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  }, []);

  const loadPointsLedger = useCallback(async () => {
    try {
      setLoadingPoints(true);
      const [overviewRes, historyRes] = await Promise.all([
        api.getPointsOverview(),
        api.getPointHistory(),
      ]);
      setPointsOverview(overviewRes);
      setTransactions(historyRes.transactions);
    } catch (err) {
      console.error('Failed to load points ledger:', err);
    } finally {
      setLoadingPoints(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
    loadPointsLedger();
    const cleanupSync = initLiveUpdateSync();
    return () => {
      cleanupSync();
    };
  }, [loadUserData, loadPointsLedger]);

  // Handle updates from components
  const handleCampaignCreated = (newCamp: Campaign, newBalance: number) => {
    setUser((prev) => (prev ? { ...prev, points: newBalance } : null));
    setMyCampaigns((prev) => [newCamp, ...prev]);
    setCampaigns((prev) => [newCamp, ...prev]);
    setActiveTab('my-campaigns');
    loadPointsLedger();
    loadUserData();
  };

  const handleCampaignUpdated = (updated: Campaign, newBalance?: number) => {
    setMyCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (newBalance !== undefined) {
      setUser((prev) => (prev ? { ...prev, points: newBalance } : null));
      loadPointsLedger();
    }
  };

  const handleTaskSubmitted = (completion: any) => {
    setSelectedTask(null);
    loadUserData();
    loadPointsLedger();
  };

  const handleBonusClaimed = (updatedUser: AnonymousUser, pts: number, xp: number) => {
    setUser(updatedUser);
    setProgressData((prev) => ({ ...prev, canClaimToday: false }));
    loadPointsLedger();
  };

  return (
    <div className="min-h-screen text-white relative selection:bg-amber-400 selection:text-neutral-950 font-sans">
      {/* 1. Dedicated Multi-Layer Background (Requirement #25 & #26) */}
      <BackgroundLayer config={themeConfig} />

      {/* 2. Splash Screen with Gold Light Sweep Animation (Requirement #28) */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* 3. Main Application Content Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <Header
          user={user}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onOpenDailyBonus={() => setShowDailyBonusModal(true)}
          canClaimDaily={progressData.canClaimToday}
        />

        {/* View Router */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {activeTab === 'home' && (
            <HomeView
              user={user}
              onSelectTab={(tab) => setActiveTab(tab)}
              onOpenDailyBonus={() => setShowDailyBonusModal(true)}
              canClaimDaily={progressData.canClaimToday}
              tasks={tasks}
              campaigns={campaigns}
              onOpenTask={(task) => setSelectedTask(task)}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              onSelectTask={(task) => setSelectedTask(task)}
            />
          )}

          {activeTab === 'create-campaign' && (
            <CreateCampaignView
              user={user}
              onCampaignCreated={handleCampaignCreated}
              onCancel={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'my-campaigns' && (
            <MyCampaignsView
              campaigns={myCampaigns}
              onRefresh={loadUserData}
              onCreateNew={() => setActiveTab('create-campaign')}
              onCampaignUpdated={handleCampaignUpdated}
            />
          )}

          {activeTab === 'points' && (
            <MyPointsView
              currentPoints={user?.points ?? pointsOverview.currentPoints}
              earnedTotal={pointsOverview.earnedTotal}
              spentTotal={pointsOverview.spentTotal}
              lockedCampaignBudget={pointsOverview.lockedCampaignBudget}
              transactions={transactions}
              onRefresh={loadPointsLedger}
              loading={loadingPoints}
            />
          )}

          {activeTab === 'progress' && (
            <MyProgressView
              user={user}
              progressPercent={progressData.progressPercent}
              xpForNext={progressData.xpForNext}
              onOpenDailyBonus={() => setShowDailyBonusModal(true)}
              canClaimDaily={progressData.canClaimToday}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              themeConfig={themeConfig}
              onUpdateTheme={handleUpdateTheme}
              onResetTheme={handleResetTheme}
              onIdentityChanged={() => {
                loadUserData();
                loadPointsLedger();
              }}
            />
          )}

          {activeTab === 'admin' && (
            <AdminDashboardView
              onDataChanged={() => {
                loadUserData();
                loadPointsLedger();
              }}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation (Requirement #29) */}
        <MobileNav
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
        />
      </div>

      {/* Daily Bonus Modal */}
      {showDailyBonusModal && (
        <DailyBonusModal
          user={user}
          onClose={() => setShowDailyBonusModal(false)}
          onBonusClaimed={handleBonusClaimed}
        />
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSubmitted={handleTaskSubmitted}
        />
      )}
    </div>
  );
}

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  addHoldingModalOpen: boolean;
  editHoldingSymbol: string | null;
  selectedStock: string | null;
}

const initialState: UIState = {
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark',
  sidebarOpen: true,
  addHoldingModalOpen: false,
  editHoldingSymbol: null,
  selectedStock: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', state.theme);
      document.documentElement.classList.toggle('dark', state.theme === 'dark');
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', state.theme);
      document.documentElement.classList.toggle('dark', state.theme === 'dark');
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    openAddHoldingModal: (state) => {
      state.addHoldingModalOpen = true;
    },
    closeAddHoldingModal: (state) => {
      state.addHoldingModalOpen = false;
    },
    openEditHoldingModal: (state, action: PayloadAction<string>) => {
      state.editHoldingSymbol = action.payload;
    },
    closeEditHoldingModal: (state) => {
      state.editHoldingSymbol = null;
    },
    selectStock: (state, action: PayloadAction<string | null>) => {
      state.selectedStock = action.payload;
    },
  },
});

export const {
  toggleTheme,
  setTheme,
  toggleSidebar,
  openAddHoldingModal,
  closeAddHoldingModal,
  openEditHoldingModal,
  closeEditHoldingModal,
  selectStock,
} = uiSlice.actions;

export default uiSlice.reducer;

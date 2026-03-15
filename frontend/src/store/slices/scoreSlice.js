import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchLatestScore = createAsyncThunk('score/latest', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/scores/latest');
    return res.data.data.score;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'No score available');
  }
});

export const fetchScoreHistory = createAsyncThunk('score/history', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/scores/history?limit=30');
    return res.data.data.scores;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchRecommendations = createAsyncThunk('score/recommendations', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/recommendations');
    return res.data.data.recommendations;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

const scoreSlice = createSlice({
  name: 'score',
  initialState: { latest: null, history: [], recommendations: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLatestScore.pending, (s) => { s.loading = true; })
      .addCase(fetchLatestScore.fulfilled, (s, a) => { s.loading = false; s.latest = a.payload; })
      .addCase(fetchLatestScore.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
      .addCase(fetchScoreHistory.fulfilled, (s, a) => { s.history = a.payload; })
      .addCase(fetchRecommendations.fulfilled, (s, a) => { s.recommendations = a.payload; });
  }
});

export default scoreSlice.reducer;

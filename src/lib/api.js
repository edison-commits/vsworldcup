export const API_BASE_URL = "https://api.vsworldcup.com";

export const API_ENDPOINTS = {
  generate: `${API_BASE_URL}/api/generate`,
  feedback: `${API_BASE_URL}/api/collections/feedback/records`,
  tournaments: `${API_BASE_URL}/api/collections/tournaments/records`,
  playSessions: `${API_BASE_URL}/api/collections/play_sessions/records`,
  activeTournaments:
    `${API_BASE_URL}/api/collections/tournaments/records?sort=-plays&perPage=50&filter=status%3D%22active%22`,
};

const API_URL = "http://localhost:3000";

export const fetchMessages = async (
  sessionId: number
) => {
  const response = await fetch(
    `${API_URL}/messages?sessionId=${sessionId}`
  );

  return response.json();
};

export const saveMessage = async (
  sessionId: number,
  speaker: string,
  text: string
) => {
  const response = await fetch(
    `${API_URL}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        speaker,
        text,
      }),
    }
  );

  return response.json();
};

export const uploadAudio = async (
  formData: FormData
) => {
  const response = await fetch(
    `${API_URL}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  return response.json();
};

export const fetchSessions = async () => {
  const response = await fetch(
    `${API_URL}/sessions`
  );

  return response.json();
};

export const createSession = async (
  title: string
) => {
  const response = await fetch(
    `${API_URL}/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
      }),
    }
  );

  return response.json();
};

export const deleteSession = async (
  sessionId: number
) => {
  const response = await fetch(
    `http://localhost:3000/sessions/${sessionId}`,
    {
      method: "DELETE",
    }
  );

  return response.json();
};

export const renameSession = async (
  sessionId: number,
  title: string
) => {
  const response = await fetch(
    `http://localhost:3000/sessions/${sessionId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        title,
      }),
    }
  );

  return response.json();
};

export const clearMessages = async (
  sessionId: number
) => {
  const response = await fetch(
    `${API_URL}/sessions/${sessionId}/messages`,
    {
      method: "DELETE",
    }
  );

  return response.json();
};
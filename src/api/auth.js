import axios from "axios";

const API =
  "http://localhost:5000/api/auth";

export const signupUser =
  async (payload) => {

    const response =
      await axios.post(
        `${API}/signup`,
        payload
      );

    return response.data;
};

export const loginUser =
  async (payload) => {

    const response =
      await axios.post(
        `${API}/login`,
        payload
      );

    return response.data;
};
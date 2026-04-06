# 🚀 Ultimate Vercel Deployment Guide (Frontend Only)

This guide will walk you through exactly how to deploy your React frontend to Vercel, step-by-step, perfectly.

---

## Step 1: Prepare Your Code on GitHub
Vercel works seamlessly by pulling your code directly from a GitHub repository.

1. Open your terminal or GitHub Desktop.
2. Make sure all your recent code is pushed to your GitHub repository.
3. Verify on GitHub.com that your frontend folder (e.g., `frontend-react` or `frontend`) is visible in the repository.

---

## Step 2: Import Project into Vercel
1. Go to [Vercel.com](https://vercel.com) and log in with your GitHub account.
2. In the Vercel dashboard, click the black **"Add New..."** button in the top right corner and select **"Project"**.
3. You will see a list of your GitHub repositories. Find your Agriculture project repository and click the **"Import"** button next to it.

---

## Step 3: Configure Project Settings (Crucial Step!)

Once you click Import, Vercel will ask you to configure the project. Follow these **exact settings**:

1. **Project Name:** You can name this whatever you want (e.g., `kisan-setu-platform`).
2. **Framework Preset:** Vercel should automatically detect this and set it to **Vite**. (If it doesn't, click the dropdown and select Vite).
3. **Root Directory:** 
   * This is the most important step! If your frontend code is inside a specific folder, you must tell Vercel.
   * Click the **"Edit"** button next to Root Directory.
   * Select your frontend folder (for example, `frontend-react` or `frontend`) and click **Save**. 

---

## Step 4: Environment Variables (Connecting the Backend)

Your frontend needs to know where your live backend is located so that logins and API calls work.

1. Expand the **"Environment Variables"** dropdown on the same configuration screen.
2. Add the following:
   * **Name:** `VITE_API_URL`
   * **Value:** *(The live link to your backend, for example: `https://agri-backend.onrender.com`)*
3. Click the **"Add"** button.

*(Note: If you have not deployed your backend yet, you can leave the Value blank and add it later in the Vercel settings under "Settings > Environment Variables")*

---

## Step 5: Deploy!
1. Click the big blue **"Deploy"** button.
2. Vercel will now take your code, run `npm install`, build the project, and host it on a global network. This takes about 1-2 minutes.
3. Once it finishes, you will see a screen with confetti! Click **"Continue to Dashboard"**.
4. In your dashboard, you will see your live `.vercel.app` domain link. Click it to view your live website!

---

## 🛠️ Typical Redployments & Updates
If you ever change your frontend code (change colors, fix bugs, add buttons):
1. Just push the code to `main` on GitHub.
2. Vercel will automatically see the changes and securely rebuild your live website without you needing to do anything manually!

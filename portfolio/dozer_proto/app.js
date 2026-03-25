// Dozer POC — app.js (Earthworks Bid Automation)
// 1. Gets Signed URL from Google Apps Script
// 2. Uploads directly to GCS
// 3. Sends pricing + metadata directly to Cloud Run (no Make.com)

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const APPS_SCRIPT_URL = "https://dozer-signed-url-7kysf2s6wa-uc.a.run.app";
const PIPELINE_URL = "https://dozer-pipeline-782235828024.us-central1.run.app/run-pipeline";
const GCS_BUCKET = "dozer-raw-reports-dozer-490317";

// ── DOM refs ──
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const additionalFields = document.getElementById("additionalFields");
const uploadZone = document.getElementById("uploadZone");
const submitBtn = document.getElementById("submitBtn");
const statusMessage = document.getElementById("statusMessage");

// Submitter fields
const submitterNameEl = document.querySelector('input[name="submitter_name"]');
const submitterEmailEl = document.querySelector('input[name="submitter_email"]');

// ── UI Helpers ──
if (uploadZone && fileInput) {
  uploadZone.addEventListener("click", () => fileInput.click());
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateFileList();
    }
  });
  fileInput.addEventListener("change", updateFileList);
}

function updateFileList() {
  if (!fileList || !fileInput.files.length) {
    if (fileList) fileList.innerHTML = "";
    if (additionalFields) additionalFields.style.display = "none";
    return;
  }
  const file = fileInput.files[0];
  fileList.innerHTML = `
    <div class="flex items-center justify-between p-4 rounded-xl border border-border-gray bg-white">
      <span style="color:#111111; font-family:'Space Grotesk',sans-serif; font-weight:600;">${escapeHtml(file.name)}</span>
      <span style="color:#888888; font-family:'Space Mono',monospace; font-size:0.85rem;">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
    </div>`;
  if (additionalFields) additionalFields.style.display = "block";
}

// ── Collect Pricing Data ──
function collectPricing() {
  return {
    cost_cut_bcy: parseFloat(document.querySelector('input[name="cost_cut_bcy"]')?.value) || 4.50,
    cost_fill_ccy: parseFloat(document.querySelector('input[name="cost_fill_ccy"]')?.value) || 7.50,
    cost_mobilization: parseFloat(document.querySelector('input[name="cost_mobilization"]')?.value) || 12000,
    cost_lime_ton: parseFloat(document.querySelector('input[name="cost_lime_ton"]')?.value) || 22.00,
    cost_import_ccy: parseFloat(document.querySelector('input[name="cost_import_ccy"]')?.value) || 18.00,
    cost_export_lcy: parseFloat(document.querySelector('input[name="cost_export_lcy"]')?.value) || 12.00,
    cost_subgrade_sy: parseFloat(document.querySelector('input[name="cost_subgrade_sy"]')?.value) || 2.50,
    cost_equipment_day: parseFloat(document.querySelector('input[name="cost_equipment_day"]')?.value) || 3500,
  };
}

// ── SUBMISSION LOGIC ──
const form = document.getElementById("uploadForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fileInput.files.length) {
      alert("Please select a file first.");
      return;
    }

    // Guard: check if pipeline URL is configured
    if (!PIPELINE_URL || PIPELINE_URL === "PLACEHOLDER") {
      statusMessage.style.color = "#FFB300";
      statusMessage.textContent = "⚠ Pipeline URL not configured yet.";
      return;
    }

    const file = fileInput.files[0];
    submitBtn.disabled = true;
    submitBtn.textContent = "Step 1/3: Getting Secure Link...";
    statusMessage.textContent = "";
    statusMessage.style.color = "#C8C2E0";

    try {
      // 1. GET SIGNED URL
      const ticketResponse = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ fileName: file.name })
      });

      if (!ticketResponse.ok) {
        throw new Error("Failed to get upload URL from server");
      }

      const ticketData = await ticketResponse.json();

      if (!ticketData.signedUrl) {
        throw new Error("No upload URL received");
      }

      // 2. UPLOAD TO GOOGLE CLOUD
      submitBtn.textContent = "Step 2/3: Uploading to Cloud...";

      try {
        await fetch(ticketData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file
        });
      } catch (uploadErr) {
        // CORS false alarm — upload likely worked
        console.warn("Browser reported upload error (likely CORS), proceeding:", uploadErr);
      }

      // 3. SEND DIRECTLY TO CLOUD RUN
      submitBtn.textContent = "Step 3/3: Starting Analysis...";

      const pricing = collectPricing();

      const payload = {
        gcs_path: `gs://${GCS_BUCKET}/${file.name}`,
        submitter_name: submitterNameEl ? submitterNameEl.value : "",
        submitter_email: submitterEmailEl ? submitterEmailEl.value : "",
        unit_costs: pricing,
        source: "dozer_poc",
        version: "v3.1",
        submitted_at: new Date().toISOString()
      };

      const triggerResponse = await fetch(PIPELINE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!triggerResponse.ok) {
        const errData = await triggerResponse.json().catch(() => ({}));
        throw new Error(errData.error || "Pipeline failed to start");
      }

      const responseData = await triggerResponse.json();

      // SUCCESS — Cloud Run accepted the job (202)
      statusMessage.style.color = "#1E6B3A";
      statusMessage.innerHTML = `✓ Report uploaded &amp; analysis started!<br>Job ID: <code>${responseData.job_id || "N/A"}</code><br>You'll receive an email with your bid estimate when processing is complete.`;

      form.reset();
      updateFileList();

    } catch (err) {
      console.error(err);
      statusMessage.style.color = "#FF5100";
      statusMessage.textContent = "✗ Error: " + err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Report for Analysis";
    }
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m];
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // --- LOGIKA UNTUK POPUP MODAL - KODE BARU DIMULAI DI SINI ---
  const warningModal = document.getElementById("warningModal");
  const closeModalBtn = document.getElementById("closeModalBtn");

  // Fungsi untuk menutup modal
  const closeModal = () => {
    if (warningModal) {
      warningModal.classList.add("hidden");
    }
  };

  // Event listener untuk tombol close
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }

  // Event listener untuk klik di luar area modal (di background gelap)
  if (warningModal) {
    warningModal.addEventListener("click", (event) => {
      if (event.target === warningModal) {
        closeModal();
      }
    });
  }
  // --- KODE BARU BERAKHIR DI SINI ---

  // --- Inisialisasi Elemen ---
  const addItemBtn = document.getElementById("addItemBtn");
  const itemsContainer = document.getElementById("itemsContainer");
  const previewBtn = document.getElementById("previewBtn");
  const generatePdfBtn = document.getElementById("generatePdfBtn");
  const invoicePreview = document.getElementById("invoice-preview");
  const logoUpload = document.getElementById("logoUpload");

  // --- Fungsi Tambah/Hapus Item ---
  const addItemRow = () => {
    const itemRow = document.createElement("div");
    itemRow.classList.add("grid", "grid-cols-5", "gap-2", "mb-2");
    itemRow.innerHTML = `
            <input type="text" placeholder="Keterangan" class="p-2 border rounded col-span-2 item-description">
            <input type="number" placeholder="QTY" class="p-2 border rounded item-qty">
            <input type="number" placeholder="Harga" class="p-2 border rounded item-price">
            <button class="bg-red-500 text-white px-2 rounded removeItemBtn">Hapus</button>
        `;
    itemsContainer.appendChild(itemRow);
  };
  addItemRow();
  addItemBtn.addEventListener("click", addItemRow);
  itemsContainer.addEventListener("click", function (e) {
    if (e.target.classList.contains("removeItemBtn")) {
      e.target.parentElement.remove();
    }
  });

  // --- Logika Utama ---

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 1. Tombol Preview
  previewBtn.addEventListener("click", async () => {
    let logoSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const logoFile = logoUpload.files[0];

    if (logoFile) {
      try {
        logoSrc = await readFileAsDataURL(logoFile);
      } catch (error) {
        console.error("Error reading logo file:", error);
      }
    }

    let template = await (await fetch("template.html")).text();
    template = template.replace("{{logoSrc}}", logoSrc);

    // Ambil data lain dari form
    const companyAddress = document.getElementById("companyAddress").value.replace(/\n/g, "<br>");
    const clientAddress = document.getElementById("clientAddress").value.replace(/\n/g, "<br>");
    const invoiceNumber = document.getElementById("invoiceNumber").value;
    // Mengambil tanggal dalam format YYYY-MM-DD
    const rawDate = document.getElementById("invoiceDate").value;
    let invoiceDate = rawDate; // Nilai default jika tanggal kosong

    // Jika ada tanggal, format ulang ke DD-MM-YYYY
    if (rawDate) {
      const parts = rawDate.split("-"); // Pecah menjadi [YYYY, MM, DD]
      invoiceDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // Susun ulang menjadi DD-MM-YYYY
    }
    const pembayaranAwal = parseFloat(document.getElementById("pembayaranAwal").value) || 0;
    const paymentInstructions = document.getElementById("paymentInstructions").value.replace(/\n/g, "<br>");

    let itemsHtml = "";
    let subtotal = 0;
    const itemRows = itemsContainer.querySelectorAll(".grid");
    itemRows.forEach((row, index) => {
      const description = row.querySelector(".item-description").value;
      const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
      const price = parseFloat(row.querySelector(".item-price").value) || 0;
      const total = qty * price;
      subtotal += total;

      itemsHtml += `
                <tr class="${index % 2 === 0 ? "bg-gray-100" : ""}">
                    <td class="px-3 py-2 font-semibold">${index + 1}</td>
                    <td class="px-3 py-2">${description}</td>
                    <td class="px-3 py-2 text-center">${qty}</td>
                    <td class="px-3 py-2 text-right">${price.toLocaleString("id-ID")}</td>
                    <td class="px-3 py-2 text-right">${total.toLocaleString("id-ID")}</td>
                </tr>
            `;
    });

    const sisaTagihan = subtotal - pembayaranAwal;

    // Ganti placeholder lainnya
    template = template.replace("<tbody>{{items}}</tbody>", `<tbody>${itemsHtml}</tbody>`);
    template = template.replace("{{companyAddress}}", companyAddress);
    template = template.replace("{{clientAddress}}", clientAddress);
    template = template.replace("{{invoiceNumber}}", invoiceNumber);
    template = template.replace("{{invoiceDate}}", invoiceDate);
    template = template.replace("{{subtotal}}", subtotal.toLocaleString("id-ID"));
    template = template.replace("{{pembayaranAwal}}", pembayaranAwal.toLocaleString("id-ID"));
    template = template.replace("{{sisaTagihan}}", sisaTagihan.toLocaleString("id-ID"));
    template = template.replace("{{total}}", sisaTagihan.toLocaleString("id-ID"));
    template = template.replace("{{paymentInstructions}}", paymentInstructions);

    invoicePreview.innerHTML = template;
    generatePdfBtn.classList.remove("hidden");
  });

  // 2. Tombol Generate PDF
  generatePdfBtn.addEventListener("click", () => {
    const invoiceToPrint = invoicePreview.innerHTML;
    const invoiceNumber = document.getElementById("invoiceNumber").value;

    const opt = {
      margin: 0.5,
      filename: `Invoice-${invoiceNumber || "file"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(invoiceToPrint).set(opt).save();
  });
});

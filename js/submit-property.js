import { convex } from './convex.js';

document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('btnSubmitProperty');
  if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const prevText = submitBtn.innerText;
      submitBtn.innerText = "Posting...";
      submitBtn.disabled = true;

      try {
        // Step 1: Types
        const step1Grids = document.querySelectorAll('#formStep1 .form-type-grid');
        const transactionType = step1Grids[0].querySelector('.active .name').innerText.trim();
        const propertyType = step1Grids[1].querySelector('.active .name').innerText.trim();

        // Step 2: Location
        const locInputs = document.querySelectorAll('#formStep2 .form-input');
        const location = {
          state: locInputs[0].value,
          city: locInputs[1].value,
          locality: locInputs[2].value,
          society: locInputs[3].value || undefined,
          fullAddress: locInputs[4].value || undefined,
          pinCode: locInputs[5].value,
          landmark: locInputs[6].value || undefined,
        };

        // Step 3: Details
        const detInputs = document.querySelectorAll('#formStep3 .form-input');
        const details = {
          bhk: detInputs[0].value,
          status: detInputs[1].value,
          builtUpArea: Number(detInputs[2].value) || 0,
          carpetArea: Number(detInputs[3].value) || undefined,
          floorNumber: Number(detInputs[4].value) || undefined,
          totalFloors: Number(detInputs[5].value) || undefined,
          furnishing: detInputs[6].value || undefined,
          facing: detInputs[7].value || undefined,
          parking: detInputs[8].value || undefined,
          constructionYear: Number(detInputs[9].value) || undefined,
          description: detInputs[10].value || "",
        };

        const amenities = [];
        document.querySelectorAll('#formStep3 input[type="checkbox"]').forEach(cb => {
          if (cb.checked) amenities.push(cb.parentElement.innerText.trim());
        });

        // Step 4: Photos (Just dummy for now as no storage is setup)
        const photos = ["images/property-1.jpg"]; // dummy photo

        // Step 5: Pricing & Contact
        const priceInputs = document.querySelectorAll('#formStep5 .form-input');
        const pricing = {
          expectedPrice: Number(priceInputs[0].value) || 0,
          priceType: priceInputs[1].value || undefined,
          maintenance: Number(priceInputs[2].value) || undefined,
          tokenAmount: Number(priceInputs[3].value) || undefined,
        };

        const contactDesc = {
          name: priceInputs[4].value,
          mobile: priceInputs[5].value,
          email: priceInputs[6].value,
          role: priceInputs[7].value || undefined,
          rera: priceInputs[8].value || undefined,
          contactTime: priceInputs[9].value || undefined,
        };

        // Submit to Convex
        const id = await convex.mutation("properties:createProperty", {
          transactionType,
          propertyType,
          location,
          details,
          amenities,
          photos,
          pricing,
          contactDesc
        });

        alert('🎉 Property posted successfully! Your listing will go live within 30 minutes.');
        window.location.href = "properties.html";
        
      } catch (err) {
        console.error("Failed to post property:", err);
        alert('❌ Error posting property. Check the console.');
      } finally {
        submitBtn.innerText = prevText;
        submitBtn.disabled = false;
      }
    });
  }
});

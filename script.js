const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

// API SETUP
const API_KEY = "AIzaSyBHBN6D1A0Xa5qlbYs1XnHZvLrne3WHvok";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

let typingInterval,controller;
const chatHistory = [];
const userData={message: "", file: {}};


// function to create message elements
const createMsgElement =(content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML =content;
  return div;
}

//scroll to bottom of container
const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight , behavior:"smooth"});

//simulate typing effect for bot responses
const typingEffect = (responseText, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = responseText.split(" ");
  let wordIndex = 0;


  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      botMsgDiv.classList.remove("loading");
      document.body.classList.add("bot-responding");
      scrollToBottom();

    } else {
      clearInterval(typingInterval);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");

    }
  }, 40);
};



//make the api call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller=new AbortController();

   // Show Stop button and hide file button properly
  fileUploadWrapper.style.display = "none";

  // Add user message and file data to the chat history
  chatHistory.push({
    role: "user",
    parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])]

  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal:controller.signal
    });

    const data = await response.json();
    if (controller.signal.aborted) return; 
    if (!response.ok) throw new Error(data.error.message);

    // Get raw response with Markdown formatting
    const responseText = data.candidates[0].content.parts[0].text.trim();

    // Remove Markdown for typing effect (keep plain text)
    const plainText = responseText
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1');

    // Start typing the plain text
    typingEffect(plainText, textElement, botMsgDiv);

    // After typing is done, replace it with full Markdown-rendered HTML
    const delay = plainText.split(" ").length * 40 + 300; 

    setTimeout(() => {
      if (!controller.signal.aborted) { 
        textElement.innerHTML = marked.parse(responseText);
        chatHistory.push({ role: "model", parts: [{ text: responseText }] });
      }
    }, delay);


    chatHistory.push({ role: "model", parts: [{ text: responseText }] });


  } catch (error) {
    textElement.style.color = "#d62939";
    textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding"); 
    scrollToBottom();
  }
  finally {
 userData.file = {};
document.body.classList.remove("bot-responding");

// Reset UI buttons after bot finishes
fileUploadWrapper.style.display = "flex";

}

};

//handle form submission
const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  promptInput.value = "";
  userData.message = userMessage;

  // File UI update
  document.body.classList.add("bot-responding", "chats-active");
  document.querySelector("#stop-response-btn").style.display = "block"; // ✅ FORCE SHOW (only if CSS fails)

  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");
  fileUploadWrapper.style.display = "none"; 
  // Create user message
  const userMsgHTML = `<p class="message-text"> </p> ${
    userData.file.data
      ? userData.file.isImage
        ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment"/>`
        : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
      : ""
  }`;

  const userMsgDiv = createMsgElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userMessage;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  // Generate bot message
  setTimeout(() => {
    const botMsgHTML = `<img src="gemini-chatbot-logo.svg" class="avatar"><p class="message-text">Just a sec...</p>`;
    const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 200);
};



//handle file input change (file upload)
// handle file input change (file upload)
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    const previewImg = fileUploadWrapper.querySelector("#file-preview");
    if (previewImg) {
      previewImg.src = e.target.result;
    }

    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

    // store file data in userData object
    userData.file= {fileName:file.name , data: base64String, mime_type: file.type, isImage }
  };
});

//cancel file upload
document.querySelector("#cancel-file-btn") .addEventListener("click", () => {
  userData.file= {};
  fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

});

//stop ongoing bot response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
  userData.file = {};
  controller?.abort();
  clearInterval(typingInterval);

  const loadingBotMsg = chatsContainer.querySelector(".bot-message.loading");
  if (loadingBotMsg) loadingBotMsg.classList.remove("loading");

  document.body.classList.remove("bot-responding");

  // Reset UI
  fileUploadWrapper.style.display = "flex";
  document.querySelector("#stop-response-btn").style.display = "none";
});




//delete chats
document.querySelector("#delete-chats-btn") .addEventListener("click", () => {
chatHistory.length = 0;
chatsContainer.innerHTML="";
document.body.classList.remove("bot-responding","chats-active");
});

//handle suggestion clicks
document.querySelectorAll(".suggestion-item").forEach(item => {
  item.addEventListener("click", () => {
    promptInput.value = item.querySelector(".text").textContent;
    document.body.classList.add("chats-active"); 
    promptForm.dispatchEvent(new Event("submit"));
  });
});


//show hide controls for the mobile on prompt input
document.addEventListener("click",({target}) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn"  || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});

//toggle light dark theme
themeToggle.addEventListener("click", () =>{
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor",isLightTheme ? "light_mode" : "dark_mode");
  themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

// set initial theme for local storage
  const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
  document.body.classList.toggle("light-theme", isLightTheme);
  themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";


promptForm.addEventListener("submit",handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());
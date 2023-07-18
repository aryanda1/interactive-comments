import Toast from "./toast.js";

const container = document.querySelector(".container");
const commentContainer = document.querySelector(".comments");

//Skeleton loading
for (let i = 0; i < 6; i++) {
  commentContainer.innerHTML += skeletonStructure();
}

const data = JSON.parse(localStorage.getItem("data"));
let curUser, comments;

if (data) processData(data);
else {
  fetch("data.json")
    .then((response) => response.json())
    .then((json) => {
      localStorage.setItem("data", JSON.stringify(json));
      processData(json);
    });
}

function processData(data) {
  curUser = data.currentUser;
  comments = data.comments;
  comments.sort((a, b) => {
    if (a.score == b.score)
      return new Date(a.createdAt) - new Date(b.createdAt);
    return b.score - a.score;
  });

  commentContainer.innerHTML = "";
  comments.forEach((comment) => {
    const commentStack = commentStackCreate(comment);
    const { replies } = comment;
    if (replies.length) {
      const nestedStack = nestedStackCreate(commentStack, true);
      replies.forEach((reply) => {
        const commentStack = commentStackCreate(reply);
        const nestedComments = nestedStack.querySelector(".nested-comments");
        nestedComments.append(commentStack);
      });
    }
    commentContainer.append(commentStack);
  });

  let newCommentForm = document.createElement("div");
  newCommentForm.innerHTML = formStructure("form", true, "SEND");
  addOnsubmitHandler(
    newCommentForm.querySelector("form"),
    newCommentSubmitHandler
  );
  handleTextAreaHeight(newCommentForm.querySelector("textarea"));
  newCommentForm = newCommentForm.firstChild;
  container.append(newCommentForm);
}

function commentStackCreate(comment) {
  const commentStack = document.createElement("div");
  commentStack.classList = "comment-stack";
  commentStack.id = comment.id;
  const { content, user, createdAt, score, likedByMe, deleted } = comment;
  commentStack.innerHTML = commentStructure(
    content,
    user.image.png,
    user.username,
    user.username == curUser.username,
    createdAt,
    score,
    comment.replyingTo,
    likedByMe,
    deleted
  );
  if (user.username == curUser.username && !deleted)
    addOnsubmitHandler(commentStack.querySelector("form"), editSubmitHandler);
  handleTextAreaHeight(commentStack.querySelector("textarea"));
  addEventListeners(commentStack, user.username == curUser.username);
  return commentStack;
}

function addEventListeners(commentStack, isCurUser = true) {
  try {
    const voteBtns = commentStack.querySelectorAll(".vote  button");
    if (voteBtns[0].disabled == false) {
      voteBtns[0].addEventListener("click", toggleScore);
      voteBtns[1].addEventListener("click", toggleScore);
    }
    const actionbtns = commentStack.querySelectorAll(".actions button");
    if (!isCurUser) {
      actionbtns[0].addEventListener("click", replyCommentHandler);
      return;
    }
    try {
      actionbtns[0].addEventListener("click", dltComment);
      actionbtns[1].addEventListener("click", editComment);
    } catch (e) {}
  } catch (e) {
    console.log(e);
  }
}

function toggleScore(e) {
  e.preventDefault();
  const btn = e.currentTarget;
  const curAction = btn.classList.contains("minus-btn") ? -1 : 1;
  const commentStack = btn.parentNode.parentNode.parentNode;
  const curComment = getCurrentComment(commentStack.id);
  const { likedByMe, score } = curComment;
  let updatedLikedByMe, updatedScore;
  if (likedByMe == curAction) {
    updatedLikedByMe = 0;
    updatedScore = +score - curAction;
    btn.classList.remove("checked");
  } else {
    updatedScore = +score - likedByMe + curAction;
    updatedLikedByMe = curAction;
    btn.classList.add("checked");
    commentStack
      .querySelector(curAction == 1 ? ".minus-btn" : ".plus-btn")
      .classList.remove("checked");
  }
  const scoreTag = commentStack.querySelector(".score");
  scoreTag.textContent = updatedScore;
  curComment.likedByMe = updatedLikedByMe;
  curComment.score = updatedScore;
  updateComments();
}

function editComment(event) {
  event.preventDefault();
  const btn = event.currentTarget;
  const comment = btn.parentNode.parentNode;
  const content = comment.querySelector(".content");
  content.querySelector(".message").classList.toggle("hidden");
  const textArea = content.querySelector(".editForm textarea");
  textArea.value = content.querySelector(".message").textContent.trim();
  content.querySelector(".editForm").classList.toggle("hidden");
  const inputEvent = new Event("input");
  textArea.dispatchEvent(inputEvent);
  textArea.focus();
  textArea.setSelectionRange(textArea.value.length, textArea.value.length);
}

function editSubmitHandler(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const commentStack = form.parentNode.parentNode.parentNode;
  const curComment = getCurrentComment(commentStack.id);
  const updatedCom = handleTextAreaText(
    form.querySelector("textarea").value,
    curComment.replyingTo
  );
  if (updatedCom == false) {
    newToast("Comment cannot be empty!", "error");
    return;
  }
  curComment.content = updatedCom[0];
  updateComments();
  form.previousElementSibling.innerHTML = updatedCom[1];
  form.classList.toggle("hidden");
  form.previousElementSibling.classList.toggle("hidden");
  newToast("Comment updated successfully", "success");
}

const confirmBtn = document.querySelector(".delete-btn");
function dltComment(e) {
  e.preventDefault();
  toggleOverlay();
  const btn = e.currentTarget;
  const commentStack = btn.parentNode.parentNode.parentNode;
  confirmBtn.setAttribute("data-id", commentStack.id);
}

const overlay = document.querySelector(".overlay");
overlay.addEventListener("click", function (e) {
  if (e.target == overlay) toggleOverlay();
});

const modal = document.querySelector(".modal");
modal.addEventListener("click", function (e) {
  e.stopPropagation();
});

function toggleOverlay() {
  document.querySelector(".overlay").classList.toggle("hidden");
}

const cancelBtn = document.querySelector(".cancel-btn");
cancelBtn.addEventListener("click", toggleOverlay);

confirmBtn.addEventListener("click", function (e) {
  e.preventDefault();
  const id = e.currentTarget.getAttribute("data-id");
  const curComment = getCurrentComment(id);
  const commentStack = document.getElementById(id);
  const header = commentStack.querySelector(".header");
  curComment.content = "Comment Deleted!";
  curComment.deleted = true;
  updateComments();
  header.querySelector(".relative-date").remove();
  try {
    header.querySelector(".user-tag").remove();
  } catch (e) {}
  const message = commentStack.querySelector(".message");
  const action = commentStack.querySelector(".actions");
  if (action.querySelector(".edit-btn")) action.remove();
  message.textContent = "Comment Deleted!";
  toggleOverlay();
  const votebtns = commentStack.querySelectorAll(".vote button");
  votebtns.forEach((btn) => (btn.disabled = true));
  newToast("Comment Deleted!", "success");
});

function newCommentSubmitHandler(e) {
  e.preventDefault();
  let commentmes = e.target.querySelector("textarea").value;
  console.log(commentmes);
  if (commentmes.trim() == "") {
    newToast("Comment cannot be empty!", "error");
    return;
  }
  let commentStack = document.createElement("div");
  commentStack.classList.add("comment-stack");
  commentStack.id = "id" + (comments.length + 1);

  commentStack.innerHTML = commentStructure(commentmes);
  addOnsubmitHandler(commentStack.querySelector("form"), editSubmitHandler);
  handleTextAreaHeight(commentStack.querySelector("textarea"));
  addEventListeners(commentStack);

  document.querySelector(".comments").prepend(commentStack);
  comments.push({
    id: `id${comments.length + 1}`,
    content: commentmes,
    createdAt: new Date(),
    score: 1,
    likedByMe: 1,
    user: curUser,
    replies: [],
  });
  updateComments();
  newToast("Comment Added!", "success");
  e.currentTarget.reset();
}

function formatTime(date) {
  const time_interval = [
    { unit: "second", value: 60 },
    { unit: "minute", value: 60 },
    { unit: "hour", value: 24 },
    { unit: "day", value: 7 },
    { unit: "week", value: 4.34524 },
    { unit: "month", value: 12 },
    { unit: "year", value: Number.MAX_SAFE_INTEGER },
  ];
  date = new Date(date);
  let difSeconds = (new Date() - date) / 1000;
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (let i = 0; i < time_interval.length; i++) {
    if (difSeconds < time_interval[i].value) {
      const unit = time_interval[i].unit;
      const val = Math.floor(difSeconds);
      return formatter.format(-val, unit);
    }
    difSeconds /= time_interval[i].value;
  }
}

function replyCommentHandler(e) {
  const comment = e.currentTarget.parentNode.parentNode;
  if (
    comment.nextElementSibling &&
    comment.nextElementSibling.classList.contains("replyForm")
  ) {
    comment.nextElementSibling.classList.toggle("hidden");
    setTimeout(() => {
      comment.nextElementSibling.remove();
    }, 300);
  } else {
    const username = comment.querySelector(".username").textContent;
    const curCommentId = comment.parentNode.id;
    const replyDiv = document.createElement("div");
    replyDiv.classList = "replyForm hidden";
    replyDiv.style.marginTop = "1rem";
    replyDiv.innerHTML = formStructure(
      "form",
      true,
      "REPLY",
      `style="margin-top: 0;" data-name=${username} data-id=${curCommentId}`
    );
    addOnsubmitHandler(replyDiv.querySelector("form"), replySubmitHandler);
    handleTextAreaHeight(replyDiv.querySelector("textarea"));
    comment.parentNode.insertBefore(replyDiv, comment.nextSibling);
    const textArea = replyDiv.querySelector("textarea");
    textArea.value = "@" + username + " ";
    textArea.focus();
    textArea.setSelectionRange(username.length + 2, username.length + 2);
    setTimeout(() => {
      replyDiv.classList.toggle("hidden");
    }, 10);
  }
}

const showRepliesBtns = document.querySelectorAll(".show-replies");
const collapseRepliesBtns = document.querySelectorAll(".collapse-line");
showRepliesBtns.forEach((btn) => btn.addEventListener("click", toggleReplies));
collapseRepliesBtns.forEach((btn) =>
  btn.addEventListener("click", toggleReplies)
);

function toggleReplies(e) {
  const btn = e.currentTarget;
  if (btn.classList.contains("show-replies")) {
    btn.previousElementSibling.classList.toggle("hidden");
    btn.classList.toggle("hidden");
  } else {
    btn.parentNode.classList.toggle("hidden");
    btn.parentNode.nextElementSibling.classList.toggle("hidden");
  }
}

function replySubmitHandler(e) {
  e.preventDefault();
  let commentmes = e.target.querySelector("textarea").value.trim();
  if (commentmes == "") {
    newToast("Comment cannot be empty!", "error");
    return;
  }
  const username = e.target.getAttribute("data-name");
  commentmes = handleTextAreaText(commentmes, username);
  if (commentmes == false) {
    newToast("Comment cannot be empty!", "error");
    return;
  }
  const replyingToId = e.target.getAttribute("data-id");
  const manParId = +replyingToId.split("-")[0].substring(2);
  const mainParComment = comments[manParId - 1];
  const replyingToComment = getCurrentComment(replyingToId);
  let commentDiv = document.createElement("div");
  commentDiv.classList.add("comment-stack");
  const curId = `id${manParId}-${Math.random().toString(36).substring(2, 6)}`;
  commentDiv.setAttribute("id", curId);
  const curComment = {
    id: curId,
    content: commentmes[0],
    createdAt: new Date(),
    score: 1,
    likedByMe: 1,
    user: curUser,
    repliesCount: 0,
    replyingTo: username,
  };
  commentDiv.innerHTML = commentStructure(commentmes[1]);
  addOnsubmitHandler(commentDiv.querySelector("form"), editSubmitHandler);
  handleTextAreaHeight(commentDiv.querySelector("textarea"));
  addEventListeners(commentDiv, true);
  const commentStack = e.target.parentNode.parentNode;
  // console.log(commentStack);

  if (commentStack.parentNode.classList.contains("comments")) {
    let nestedStack = commentStack.querySelector(".nested-comments-stack");
    if (nestedStack)
      nestedStack.querySelector(".nested-comments").prepend(commentDiv);
    else {
      nestedStack = nestedStackCreate(commentStack, false);
      const nestedComments = nestedStack.querySelector(".nested-comments");
      nestedComments.append(commentDiv);
    }
    mainParComment.replies.push(curComment);
  } else {
    commentStack.parentNode.insertBefore(commentDiv, commentStack.nextSibling);
    mainParComment.replies.splice(
      mainParComment.replies.findIndex(
        (com) => com.id == replyingToComment.id
      ) +
        replyingToComment.repliesCount +
        1,
      0,
      curComment
    );
    replyingToComment.repliesCount += 1;
  }
  updateComments();
  const showReplyBtn = document
    .querySelector(`#${mainParComment.id}`)
    .querySelector(".show-replies");
  // console.log(showReplyBtn.classList.contains("hidden"));
  if (!showReplyBtn.classList.contains("hidden")) showReplyBtn.click();
  e.target.parentNode.remove();
  newToast("Reply Added Successfully", "success");
}

function nestedStackCreate(commentStack, hideNest) {
  let nestedStack = document.createElement("div");
  nestedStack.classList = `nested-comments-stack ${hideNest ? "hidden" : ""}`;
  nestedStack.innerHTML = `
    <button class="collapse-line"></button>
    <div class='nested-comments'></div>
    `;

  commentStack.append(nestedStack);
  const showReplyBtn = document.createElement("button");
  showReplyBtn.classList = `btn show-replies ${!hideNest ? "hidden" : ""}`;
  showReplyBtn.innerText = "Show Replies";
  showReplyBtn.addEventListener("click", toggleReplies);
  nestedStack.querySelector("button").addEventListener("click", toggleReplies);
  // console.log(commentStack);
  commentStack.append(showReplyBtn);
  return nestedStack;
}

function commentStructure(
  commentMessage,
  avatar = curUser.image.png,
  username = curUser.username,
  isCurUser = true,
  date = new Date(),
  score = 1,
  replyingTo = "",
  likedByMe = 1,
  deleted = false
) {
  // console.log(avatar);
  return `
<div class='comment'>
  <div class="header">
    <div class="img">
      <img class='skeleton' src=${avatar} alt="del"/>
    </div>
    <p class="username">${username}</p>
    ${deleted ? "" : isCurUser ? '<p class="user-tag">you</p>' : ""}
    <p class="relative-date">${deleted ? "" : formatTime(date)}</p>
  </div>
  <div class="content">
    <div class="message">
      ${
        deleted
          ? commentMessage
          : handleTextAreaText(commentMessage, replyingTo)[1]
      }
    </div>
    ${
      isCurUser && deleted == false
        ? formStructure("editForm hidden", false, "UPDATE")
        : ""
    }
  </div>
  <div class="vote">
    <button class='plus-btn ${likedByMe === 1 ? "checked" : ""}' ${
    deleted ? "disabled" : ""
  }>
      <svg class="icon">
        <use xlink:href="images/sprite.svg#icon-plus"></use>
      </svg>
    </button>
    <p class="score">${score}</p>
    <button class="minus-btn ${likedByMe === -1 ? "checked" : ""}" ${
    deleted ? "disabled" : ""
  }>
      <svg class="icon">
        <use xlink:href="images/sprite.svg#icon-minus"></use>
      </svg>
    </button>
  </div>
  <div class="actions">
  ${
    isCurUser
      ? deleted == false
        ? `<button class="dlt-btn">
      <svg class="icon">
        <use xlink:href="images/sprite.svg#icon-delete"></use>
      </svg>Delete
    </button>
    <button class="edit-btn">
      <svg class="icon">
        <use xlink:href="images/sprite.svg#icon-edit"></use>
      </svg>Edit
    </button>`
        : ""
      : `<button class="reply-btn"><svg class="icon">
    <use xlink:href="images/sprite.svg#icon-reply"> </use></svg>Reply</button>`
  }
  </div>
  </div>`;
}

function skeletonStructure() {
  return `
  <div class="comment-stack">
    <div class="comment">
      <div class="header">
        <div class="img">
          <img class="skeleton"  src="https://source.unsplash.com/100x100/?nature"></img>
        </div>
        <div style="width:100%;">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
        </div>
        </div>
      <div class="content">
        <div class="message">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
      </div>
    </div>
  </div>
  `;
}

function formStructure(
  className,
  imgRequired,
  submitBtnText,
  extraStyles = ""
) {
  return `<form class="${className}" ${extraStyles}>
  ${
    imgRequired
      ? `<div class="img">
    <img src=${curUser.image.png} class="skeleton" />
  </div>`
      : ""
  }
  <textarea
    name=""
    id=""
    rows="3"
    placeholder="Add a comment..."
  ></textarea>
  <button>${submitBtnText}</button>
</form>`;
}

function handleTextAreaHeight(textArea) {
  if (!textArea) return;
  // console.log(textArea);
  textArea.setAttribute(
    "style",
    "height:" + Math.max(52, textArea.scrollHeight) + "px;overflow-y:hidden;"
  );
  textArea.addEventListener("input", OnInput, false);
}

function OnInput() {
  this.style.height = 0;
  this.style.height = this.scrollHeight + "px";
}

function handleTextAreaText(text, username = "") {
  if (username.length && !username.startsWith("@")) username = "@" + username;
  if (text.startsWith(username)) text = text.substring(username.length).trim();
  if (text.length == 0) return false;
  let textWithUsername = `<p style="white-space: pre-wrap;display:inline;">${text}</p>`;
  if (username.length)
    textWithUsername = `<strong>${username}</strong> ${textWithUsername}`;
  return [text, textWithUsername];
}

function updateComments() {
  localStorage.setItem(
    "data",
    JSON.stringify({ currentUser: curUser, comments })
  );
}

function getCurrentComment(commentId) {
  const indixes = commentId.split("-");
  indixes[0] = indixes[0].substring(2);
  return indixes[1] == undefined
    ? comments[indixes[0] - 1]
    : comments[indixes[0] - 1].replies.find(
        (comment) => comment.id == commentId
      );
}

function newToast(mes, type) {
  new Toast({
    text: mes,
    type: type,
    position: "bottom-right",
    pauseOnHover: true,
    pauseOnFocusLoss: true,
  });
}

function addOnsubmitHandler(form, handler) {
  form.addEventListener("submit", handler);
}

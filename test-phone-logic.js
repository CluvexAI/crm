const phone = "+353877122594";
const dbPhone = "0877122594";

const p1 = String(dbPhone).replace(/\D/g, '');
const p2 = String(phone).replace(/\D/g, '');

let phoneMatch = false;
if (p1 === p2) {
  phoneMatch = true;
  console.log("Exact match");
} else if (p1.length >= 7 && p2.length >= 7) {
  const p1Trim = p1.replace(/^0+/, '');
  const p2Trim = p2.replace(/^0+/, '');
  console.log(`p1Trim: ${p1Trim}, p2Trim: ${p2Trim}`);
  if (p1.includes(p2Trim) || p2.includes(p1Trim)) {
    phoneMatch = true;
    console.log("Substring match");
  }
}

console.log("Match Result:", phoneMatch);

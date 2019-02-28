$(document).ready(function() {
  $('div.hidden').fadeIn(1000).removeClass('hidden');

  $("GLMIexplanation").hide();

  $('#moreGLMI').click(function() {
      $('#GLMIexplanation').fadeToggle(750);
      $('#moreGLMIbtn').fadeToggle(0);
  });

  $('#moreGLMIbtn').click(function() {
      $('#moreGLMIbtn').hide();
      $('#GLMIexplanation').fadeIn(750);
  });
});
